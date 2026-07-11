"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { getUserPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { projectInputSchema } from "@/shared/lib/validators/projects";

import { resolveProjectCreationAssignments } from "../lib/create-project";
import { assertParticipantsBelongToAdvisor, resolveProjectCreationContext } from "../lib/project-governance";
import { assignProjectLeader } from "../lib/project-state-service";
import { grantProjectScopedTag } from "../lib/tag-grants";

export async function createProject(input: unknown) {
  const user = await requireActiveUser();
  const data = projectInputSchema.parse(input);

  const permission = user.role === "ADMIN"
    ? PERMISSIONS.PROJECT_CREATE_ON_BEHALF
    : PERMISSIONS.PROJECT_CREATE;
  await assertPermissionWithAudit({
    userId: user.id,
    permission,
    entityType: "Project",
  });

  let project: { id: string };
  try {
    project = await prisma.$transaction(async (tx) => {
      const [[{ now }], currentActor] = await Promise.all([
        tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
        tx.user.findUnique({
          where: { id: user.id },
          select: {
            role: true,
            status: true,
            displayName: true,
            studyDegree: true,
            identityNeedsReview: true,
          },
        }),
      ]);
      const currentPermission = currentActor?.role === "ADMIN"
        ? PERMISSIONS.PROJECT_CREATE_ON_BEHALF
        : PERMISSIONS.PROJECT_CREATE;
      const currentPermissions = await getUserPermissionsForClient(tx, user.id, now);
      if (!currentActor || currentActor.status !== "ACTIVE" || !currentPermissions.has(currentPermission)) {
        throw new PermissionDeniedError(currentPermission);
      }

      const creatorIsAdvisor = currentActor.role === "MEMBER"
        && currentActor.studyDegree === "MENTOR"
        && !currentActor.identityNeedsReview;
      const creationContext = resolveProjectCreationContext({
        actorId: user.id,
        actorRole: currentActor.role,
        actorIsAdvisor: creatorIsAdvisor,
        selectedAdvisorId: data.advisorId,
      });
      const assignments = resolveProjectCreationAssignments({
        creatorUserId: user.id,
        leadUserId: data.leadUserId,
        memberUserIds: data.memberUserIds,
        excludeCreatorFromLead: creatorIsAdvisor,
        excludeCreatorFromMembers: creatorIsAdvisor,
      });
      const advisorId = creationContext.advisorId;
      const participantIds = [assignments.leadUserId, ...assignments.memberUserIds];
      const participants = await tx.user.findMany({
        where: {
          id: { in: participantIds },
          role: "MEMBER",
          status: "ACTIVE",
          studyDegree: { in: ["MASTER", "DOCTOR"] },
          identityNeedsReview: false,
        },
        select: { id: true, advisorId: true, displayName: true, studyDegree: true, status: true },
      });
      if (participants.length !== new Set(participantIds).size) {
        throw new Error("项目组长或成员不存在、身份未确认，或账号不可用。");
      }

      const advisor = await tx.user.findFirst({
        where: {
          id: advisorId,
          role: "MEMBER",
          status: "ACTIVE",
          studyDegree: "MENTOR",
          identityNeedsReview: false,
        },
        select: { id: true, displayName: true, studyDegree: true, status: true },
      });
      if (!advisor) throw new Error("所选负责导师不存在、已停用或导师身份已失效。");
      assertParticipantsBelongToAdvisor(advisorId, participantIds, participants);
      const leader = participants.find((participant) => participant.id === assignments.leadUserId);
      if (!leader) throw new Error("项目组长不存在或账号不可用。");
      const advisorSnapshot = createActorSnapshot(advisor, now);
      const leaderSnapshot = createActorSnapshot(leader, now);

      const createdProject = await tx.project.create({
        data: {
          name: data.name,
          description: data.description,
          creatorId: creationContext.creatorId,
          creatorSnapshot: advisorSnapshot,
          advisorId,
          advisorSnapshot,
          leaderId: assignments.leadUserId,
          leaderSnapshot,
        },
      });

      await assignProjectLeader(tx, {
        projectId: createdProject.id,
        leaderId: assignments.leadUserId,
        actorId: user.id,
      });

      for (const memberUserId of assignments.memberUserIds) {
        await grantProjectScopedTag(tx, {
          kind: "member",
          userId: memberUserId,
          projectId: createdProject.id,
          projectName: createdProject.name,
          grantedById: user.id,
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorSnapshot: createActorSnapshot(currentActor, now),
          action: "CREATE",
          entityType: "Project",
          entityId: createdProject.id,
          details: {
            leadUserId: assignments.leadUserId,
            memberUserIds: assignments.memberUserIds,
            advisorId,
            delegated: creationContext.delegated,
          },
        },
      });

      return createdProject;
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: user.id,
        permission: error.permission,
        entityType: "Project",
      });
    }
    throw error;
  }

  revalidatePath("/projects");
  revalidatePath("/");
  return project;
}

export type ProjectFormState = { ok: boolean; message: string | null };

export async function createProjectFormAction(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  let projectId: string;
  try {
    const project = await createProject({
      name: formData.get("name"),
      description: formData.get("description"),
      leadUserId: formData.get("leadUserId"),
      memberUserIds: formData.getAll("memberUserIds").map(String).filter(Boolean),
      advisorId: formData.get("advisorId") || undefined,
    });
    projectId = project.id;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "创建失败" };
  }
  // redirect() throws, so it must run outside the try/catch.
  redirect(`/projects/${projectId}`);
}
