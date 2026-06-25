"use server";

import { revalidatePath } from "next/cache";

import { assertProjectPermissionWithAudit } from "@/shared/lib/authorization";
import { shouldNotifyRecipient } from "@/features/notifications/lib/recipients";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { projectMemberInputSchema } from "@/shared/lib/validators/projects";

import { grantProjectScopedTag } from "../lib/tag-grants";
import { assertProjectWritable } from "../lib/writable";

export async function addProjectMember(input: unknown) {
  const actor = await requireActiveUser();
  const data = projectMemberInputSchema.parse(input);

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
      select: { id: true, name: true },
    });
    await tx.user.findFirstOrThrow({
      where: { id: data.userId, status: "ACTIVE" },
      select: { id: true },
    });

    const memberTag = await grantProjectScopedTag(tx, {
      kind: "member",
      userId: data.userId,
      projectId: data.projectId,
      projectName: project.name,
      grantedById: actor.id,
    });

    if (shouldNotifyRecipient(actor.id, data.userId)) {
      await tx.notification.create({
        data: {
          userId: data.userId,
          senderId: actor.id,
          type: "TAG_GRANTED",
          title: "加入项目",
          content: memberTag.displayName,
          relatedType: "PROJECT",
          relatedId: data.projectId,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "CREATE",
        entityType: "ProjectMember",
        entityId: data.projectId,
        details: { userId: data.userId },
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
    await addProjectMember({
      projectId: formData.get("projectId"),
      userId: formData.get("userId"),
    });
    return { ok: true, message: "成员已加入" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "添加失败" };
  }
}
