"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@prisma/client";

import { toActionResult } from "@/shared/lib/action-result";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { getProjectPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";

import { assertProjectCanArchiveStatus, resolveProjectArchiveAccess } from "../lib/archive";
import { isCanonicalProjectLeaderEligible } from "../lib/project-responsibility";

export async function archiveProject(projectId: string) {
  const user = await requireActiveUser();

  try {
    return await prisma.$transaction(async (tx) => {
      const actor = await getLockedActiveActor(tx, user.id);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`);
      const current = await tx.project.findFirstOrThrow({
        where: { id: projectId, deletedAt: null },
        select: { status: true, advisorId: true, leaderId: true },
      });
      if (!actor) throw new PermissionDeniedError(PERMISSIONS.PROJECT_MANAGE);
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
      assertProjectCanArchiveStatus(current.status);

      const project = await tx.project.update({
        where: { id: projectId },
        data: {
          status: "ARCHIVED",
          archivedAt: actor.now,
          archivedById: user.id,
          archivedBySnapshot: actor.actorSnapshot,
          leaderNeedsReassignment: false,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorSnapshot: actor.actorSnapshot,
          action: "UPDATE",
          entityType: "Project",
          entityId: projectId,
          details: { status: "ARCHIVED", scope: access.scope },
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

export async function archiveProjectFormAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  await archiveProject(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function archiveProjectResult(projectId: string) {
  return toActionResult(async () => {
    await archiveProject(projectId);
    return null;
  }, {
    fallbackMessage: "项目归档失败，请稍后重试。",
    knownMessages: ["只有规划中或进行中的项目可以归档。"],
  });
}
