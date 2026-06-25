"use server";

import { revalidatePath } from "next/cache";

import { shouldNotifyRecipient } from "@/features/notifications/lib/recipients";
import { appendAuditLog } from "@/shared/lib/audit";
import { PERMISSIONS, PermissionDeniedError, type Permission, getUserPermissions } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { grantTagInputSchema } from "@/shared/lib/validators/tags";

import { assertManuallyManageableTagName } from "../lib/project-tag-guard";

async function assertAnyTagPermission(userId: string, permissions: readonly Permission[], entityId?: string | null) {
  const granted = await getUserPermissions(userId);
  if (permissions.some((permission) => granted.has(permission))) return;

  const permission = permissions[0] ?? PERMISSIONS.ADMIN_TAG_MANAGE;
  await appendAuditLog({
    userId,
    action: "PERMISSION_DENIED",
    entityType: "UserTag",
    entityId,
    details: { permission },
  });
  throw new PermissionDeniedError(permission);
}

export async function grantTag(input: unknown) {
  const actor = await requireActiveUser();
  const data = grantTagInputSchema.parse(input);

  await assertAnyTagPermission(actor.id, [PERMISSIONS.ADMIN_TAG_MANAGE, PERMISSIONS.TAG_APPROVE], data.userId);

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
  const existing = await prisma.userTag.findFirst({
    where: {
      userId: data.userId,
      tagId: data.tagId,
      projectId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (existing) return { id: existing.id };

  const userTag = await prisma.$transaction(async (tx) => {
    const created = await tx.userTag.create({
      data: {
        userId: data.userId,
        tagId: data.tagId,
        projectId,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        grantedById: actor.id,
      },
    });

    if (shouldNotifyRecipient(actor.id, data.userId)) {
      await tx.notification.create({
        data: {
          userId: data.userId,
          type: "TAG_GRANTED",
          title: "获得新 Tag",
          content: tag.displayName,
          relatedType: "TAG",
          relatedId: tag.id,
        },
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
