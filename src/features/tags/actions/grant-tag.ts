"use server";

import { revalidatePath } from "next/cache";

import { includeActiveAdminsInNotificationRecipients } from "@/features/notifications/lib/recipients";
import { getDatabaseNow, lockUserLifecycle, orderUserLifecycleLockIds } from "@/features/admin/lib/user-lifecycle";
import { toActionResult } from "@/shared/lib/action-result";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { assertAnyPermissionWithAudit } from "@/shared/lib/authorization";
import { getUserPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { ADVISOR_TAG_NAME } from "@/shared/lib/system-tags";
import { grantTagInputSchema } from "@/shared/lib/validators/tags";

import { assertManualTagTargetEligible, assertManuallyManageableTagName } from "../lib/project-tag-guard";

const tagFeedbackMessages = [
  "目标成员不存在。",
  "管理员是治理账号，不能被授予或撤销 Tag。",
  "仅可管理在用成员的 Tag。",
  "项目范围 Tag 必须指定项目。",
  "全局 Tag 不能指定项目。",
  "项目组标签由项目流程自动管理，不能手动授予或撤销。",
  "毕业状态由用户状态流程管理，不能手动授予或撤销毕业 Tag。",
  "培养身份系统 Tag 由学位字段自动维护，不能手动授予或撤销。",
  "执行 Tag 操作的账号已失效。",
] as const;

const TAG_MANAGE_PERMISSIONS = [PERMISSIONS.ADMIN_TAG_MANAGE, PERMISSIONS.TAG_APPROVE] as const;

export async function grantTag(input: unknown) {
  const actor = await requireActiveUser();
  const data = grantTagInputSchema.parse(input);

  await assertAnyPermissionWithAudit({
    userId: actor.id,
    permissions: TAG_MANAGE_PERMISSIONS,
    entityType: "UserTag",
    entityId: data.userId,
  });

  const tag = await prisma.tag.findUniqueOrThrow({
    where: { id: data.tagId },
    select: { id: true, name: true, displayName: true, scope: true },
  });
  assertManuallyManageableTagName(tag.name);

  if (tag.scope === "PROJECT" && !data.projectId) {
    throw new Error("项目范围 Tag 必须指定项目。");
  }
  if (tag.scope === "GLOBAL" && data.projectId) {
    throw new Error("全局 Tag 不能指定项目。");
  }

  const projectId = data.projectId ?? null;
  let userTag: { id: string };
  try {
    userTag = await prisma.$transaction(async (tx) => {
      for (const userId of orderUserLifecycleLockIds([actor.id, data.userId])) {
        await lockUserLifecycle(tx, userId);
      }
      const now = await getDatabaseNow(tx);
      const [target, currentActor, currentPermissions] = await Promise.all([
        tx.user.findUnique({
          where: { id: data.userId },
          select: { role: true, status: true },
        }),
        tx.user.findFirst({
          where: { id: actor.id, status: "ACTIVE" },
          select: { displayName: true, studyDegree: true, status: true },
        }),
        getUserPermissionsForClient(tx, actor.id, now),
      ]);
      assertManualTagTargetEligible(target);
      if (!currentActor) throw new Error("执行 Tag 操作的账号已失效。");
      if (!TAG_MANAGE_PERMISSIONS.some((permission) => currentPermissions.has(permission))) {
        throw new PermissionDeniedError(TAG_MANAGE_PERMISSIONS[0]);
      }
      const actorSnapshot = createActorSnapshot(currentActor, now);

      const existing = await tx.userTag.findFirst({
        where: {
          userId: data.userId,
          tagId: data.tagId,
          projectId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
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
          granterSnapshot: actorSnapshot,
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
            senderSnapshot: actorSnapshot,
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
          actorSnapshot,
          action: "TAG_GRANT",
          entityType: "UserTag",
          entityId: created.id,
          details: { userId: data.userId, tagName: tag.name, projectId },
        },
      });

      return created;
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: actor.id,
        permission: error.permission,
        entityType: "UserTag",
        entityId: data.userId,
      });
    }
    throw error;
  }

  revalidatePath("/admin/tags");
  revalidatePath("/admin/users");
  return { id: userTag.id };
}

export async function grantTagResult(input: unknown) {
  return toActionResult(async () => {
    await grantTag(input);
    return null;
  }, {
    fallbackMessage: "Tag 授予失败，请稍后重试。",
    knownMessages: tagFeedbackMessages,
  });
}
