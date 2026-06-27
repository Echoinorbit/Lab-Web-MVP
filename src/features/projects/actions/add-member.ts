"use server";

import { revalidatePath } from "next/cache";

import { assertProjectPermissionWithAudit } from "@/shared/lib/authorization";
import { includeActiveAdminsInNotificationRecipients } from "@/features/notifications/lib/recipients";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { projectMemberInputSchema, projectMembersInputSchema } from "@/shared/lib/validators/projects";

import { grantProjectScopedTag } from "../lib/tag-grants";
import { assertParticipantsBelongToAdvisor } from "../lib/project-governance";
import { assertProjectWritable } from "../lib/writable";

export async function addProjectMember(input: unknown) {
  const legacy = projectMemberInputSchema.safeParse(input);
  return addProjectMembers(legacy.success
    ? { projectId: legacy.data.projectId, userIds: [legacy.data.userId] }
    : input);
}

export async function addProjectMembers(input: unknown) {
  const actor = await requireActiveUser();
  const data = projectMembersInputSchema.parse(input);

  await assertProjectPermissionWithAudit({
    userId: actor.id,
    permission: PERMISSIONS.PROJECT_MEMBER_MANAGE,
    projectId: data.projectId,
    entityType: "ProjectMember",
    entityId: data.projectId,
  });
  await assertProjectWritable(data.projectId);

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirstOrThrow({
      where: { id: data.projectId, deletedAt: null },
      select: { id: true, name: true, advisorId: true },
    });
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
        action: "CREATE",
        entityType: "ProjectMember",
        entityId: data.projectId,
        details: { userIds: data.userIds },
      },
    });
  });

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
