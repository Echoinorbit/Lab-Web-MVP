"use server";

import { revalidatePath } from "next/cache";

import { includeActiveAdminsInNotificationRecipients } from "@/features/notifications/lib/recipients";
import { assertAnyPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { ADVISOR_TAG_NAME } from "@/shared/lib/system-tags";
import { grantTagInputSchema } from "@/shared/lib/validators/tags";

import { assertManuallyManageableTagName } from "../lib/project-tag-guard";

export async function grantTag(input: unknown) {
  const actor = await requireActiveUser();
  const data = grantTagInputSchema.parse(input);

  await assertAnyPermissionWithAudit({
    userId: actor.id,
    permissions: [PERMISSIONS.ADMIN_TAG_MANAGE, PERMISSIONS.TAG_APPROVE],
    entityType: "UserTag",
    entityId: data.userId,
  });

  const tag = await prisma.tag.findUniqueOrThrow({
    where: { id: data.tagId },
    select: { id: true, name: true, displayName: true, scope: true },
  });
  assertManuallyManageableTagName(tag.name);

  if (tag.scope === "PROJECT" && !data.projectId) {
    throw new Error("Project-scoped tags require projectId.");
  }
  if (tag.scope === "GLOBAL" && data.projectId) {
    throw new Error("Global tags must not include projectId.");
  }

  const projectId = data.projectId ?? null;
  const userTag = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUniqueOrThrow({
      where: { id: data.userId },
      select: { role: true },
    });
    if (target.role === "ADMIN") {
      throw new Error("管理员是治理账号，不能被授予 Tag。");
    }

    const existing = await tx.userTag.findFirst({
      where: {
        userId: data.userId,
        tagId: data.tagId,
        projectId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true },
    });
    if (existing) return existing;

    if (tag.name === ADVISOR_TAG_NAME) {
      await tx.user.update({ where: { id: data.userId }, data: { advisorId: null } });
    }

    const created = await tx.userTag.create({
      data: {
        userId: data.userId,
        tagId: data.tagId,
        projectId,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        grantedById: actor.id,
      },
    });

    const recipientIds = await includeActiveAdminsInNotificationRecipients(tx, {
      recipientIds: [data.userId],
      actorId: actor.id,
    });
    if (recipientIds.length > 0) {
      await tx.notification.createMany({
        data: recipientIds.map((recipientId) => ({
          userId: recipientId,
          senderId: actor.id,
          type: "TAG_GRANTED",
          title: "获得新 Tag",
          content: tag.displayName,
          relatedType: "TAG",
          relatedId: tag.id,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "TAG_GRANT",
        entityType: "UserTag",
        entityId: created.id,
        details: { userId: data.userId, tagName: tag.name, projectId },
      },
    });

    return created;
  });

  revalidatePath("/admin/tags");
  revalidatePath("/admin/users");
  return { id: userTag.id };
}

export type TagActionState = { ok: boolean; message: string | null };

export async function grantTagFormAction(
  _prevState: TagActionState,
  formData: FormData,
): Promise<TagActionState> {
  try {
    await grantTag({
      userId: formData.get("userId"),
      tagId: formData.get("tagId"),
      projectId: formData.get("projectId") || undefined,
    });
    return { ok: true, message: "Tag 已授予" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "授予失败" };
  }
}
