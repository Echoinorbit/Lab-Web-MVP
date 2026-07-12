"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@prisma/client";

import { toActionResult } from "@/shared/lib/action-result";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { getProjectPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

import {
  assertProjectCanUnarchive,
  resolveProjectArchiveAccess,
} from "../lib/archive";
import {
  PROJECT_REACTIVATION_ADVISOR_REQUIRED_MESSAGE,
  PROJECT_RESPONSIBILITY_CHANGED_MESSAGE,
  isCanonicalProjectAdvisorEligible,
  isCanonicalProjectLeaderEligible,
  lockProjectResponsibilityContext,
  reconcileCanonicalProjectLeadershipForUser,
} from "../lib/project-responsibility";

export async function unarchiveProject(projectId: string) {
  const user = await requireActiveUser();
  try {
    return await prisma.$transaction(async (tx) => {
      const context = await lockProjectResponsibilityContext(tx, { projectId, actorId: user.id });
      if (!context?.actor || context.project.deletedAt) {
        throw new PermissionDeniedError(PERMISSIONS.PROJECT_MANAGE);
      }
      const { actor, project: current } = context;
      const projectPermissions = await getProjectPermissionsForClient(tx, user.id, projectId, actor.now);
      const globalPermissions = actor.actor.role === "ADMIN"
        ? new Set([PERMISSIONS.PROJECT_ARCHIVE_ANY])
        : new Set<never>();
      const access = resolveProjectArchiveAccess({
        actorId: user.id,
        actorCanLead: isCanonicalProjectLeaderEligible(actor.actor, current.advisorId),
        leaderId: current.leaderId,
        globalPermissions,
        projectPermissions,
      });
      if (!access.allowed) throw new PermissionDeniedError(PERMISSIONS.PROJECT_MANAGE);
      assertProjectCanUnarchive(
        current.status,
        current.archivedAt,
        isCanonicalProjectAdvisorEligible(context.advisor),
        actor.now,
      );

      const leaderEligible = isCanonicalProjectLeaderEligible(context.leader, current.advisorId);
      if (current.leaderId && !leaderEligible) {
        await reconcileCanonicalProjectLeadershipForUser(tx, {
          userId: current.leaderId,
          now: actor.now,
          revokedBy: { id: user.id, snapshot: actor.actorSnapshot },
        });
      }
      const leaderId = leaderEligible ? current.leaderId : null;

      const project = await tx.project.update({
        where: { id: projectId },
        data: {
          status: "PLANNING",
          archivedAt: null,
          archivedById: null,
          archivedBySnapshot: Prisma.DbNull,
          leaderNeedsReassignment: leaderId === null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorSnapshot: actor.actorSnapshot,
          action: "UPDATE",
          entityType: "Project",
          entityId: projectId,
          details: { status: project.status, scope: access.scope, leaderNeedsReassignment: leaderId === null },
        },
      });
      return project;
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: user.id,
        permission: error.permission,
        entityType: "Project",
        entityId: projectId,
      });
    }
    throw error;
  }
}

export async function unarchiveProjectFormAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  await unarchiveProject(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function unarchiveProjectResult(projectId: string) {
  return toActionResult(async () => {
    await unarchiveProject(projectId);
    return null;
  }, {
    fallbackMessage: "项目启用失败，请稍后重试。",
    knownMessages: [
      "只有已归档的项目可以重新启用。",
      PROJECT_REACTIVATION_ADVISOR_REQUIRED_MESSAGE,
      PROJECT_RESPONSIBILITY_CHANGED_MESSAGE,
      "归档后 7 天内不可重新启用",
    ],
  });
}
