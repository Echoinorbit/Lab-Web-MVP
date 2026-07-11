"use server";

import { revalidatePath } from "next/cache";

import { includeActiveAdminsInNotificationRecipients } from "@/features/notifications/lib/recipients";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { getProjectPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { projectMembersInputSchema } from "@/shared/lib/validators/projects";

import { grantProjectScopedTag } from "../lib/tag-grants";
import { assertParticipantsBelongToAdvisor, isEligibleProjectLeaderActor } from "../lib/project-governance";
import { assertProjectWritableStatus } from "../lib/writable";

export async function addProjectMembers(input: unknown) {
  const actor = await requireActiveUser();
  const data = projectMembersInputSchema.parse(input);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${data.projectId} FOR UPDATE`;
      const [{ now }, project, currentActor] = await Promise.all([
        tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`.then((rows) => rows[0]!),
        tx.project.findFirstOrThrow({
          where: { id: data.projectId, deletedAt: null },
          select: { id: true, name: true, advisorId: true, leaderId: true, status: true },
        }),
        tx.user.findUnique({
          where: { id: actor.id },
          select: {
            role: true,
            status: true,
            displayName: true,
            studyDegree: true,
            identityNeedsReview: true,
          },
        }),
      ]);
      const projectPermissions = await getProjectPermissionsForClient(tx, actor.id, data.projectId, now);
      const isCurrentLeader = currentActor
        ? isEligibleProjectLeaderActor(currentActor) && project.leaderId === actor.id
        : false;
      if (
        !currentActor
        || currentActor.status !== "ACTIVE"
        || (!isCurrentLeader && !projectPermissions.has(PERMISSIONS.PROJECT_MEMBER_MANAGE))
      ) {
        throw new PermissionDeniedError(PERMISSIONS.PROJECT_MEMBER_MANAGE);
      }
      assertProjectWritableStatus(project.status);
      if (!project.advisorId) throw new Error("项目未设置负责导师，不能添加学生。");
      const participants = await tx.user.findMany({
        where: { id: { in: data.userIds }, role: "MEMBER", status: "ACTIVE" },
        select: { id: true, advisorId: true },
      });
      assertParticipantsBelongToAdvisor(project.advisorId, data.userIds, participants);

      let memberTagName = project.name;
      for (const userId of data.userIds) {
        const memberTag = await grantProjectScopedTag(tx, {
          kind: "member",
          userId,
          projectId: data.projectId,
          projectName: project.name,
          grantedById: actor.id,
        });
        memberTagName = memberTag.displayName;
      }

      const recipientIds = await includeActiveAdminsInNotificationRecipients(tx, {
        recipientIds: data.userIds,
        actorId: actor.id,
      });
      if (recipientIds.length > 0) {
        await tx.notification.createMany({
          data: recipientIds.map((recipientId) => ({
            userId: recipientId,
            senderId: actor.id,
            type: "TAG_GRANTED",
            title: "加入项目",
            content: memberTagName,
            relatedType: "PROJECT",
            relatedId: data.projectId,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot: createActorSnapshot(currentActor, now),
          action: "CREATE",
          entityType: "ProjectMember",
          entityId: data.projectId,
          details: { userIds: data.userIds },
        },
      });
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: actor.id,
        permission: error.permission,
        entityType: "ProjectMember",
        entityId: data.projectId,
      });
    }
    throw error;
  }

  revalidatePath(`/projects/${data.projectId}`);
}

export type ProjectMemberState = { ok: boolean; message: string | null };

export async function addProjectMemberFormAction(
  _prevState: ProjectMemberState,
  formData: FormData,
): Promise<ProjectMemberState> {
  try {
    await addProjectMembers({
      projectId: formData.get("projectId"),
      userIds: formData.getAll("userIds").map(String).filter(Boolean),
    });
    return { ok: true, message: "成员已加入" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "添加失败" };
  }
}
