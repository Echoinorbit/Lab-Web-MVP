"use server";

import { revalidatePath } from "next/cache";

import { getDatabaseNow, lockUserLifecycle, orderUserLifecycleLockIds } from "@/features/admin/lib/user-lifecycle";
import { toActionResult } from "@/shared/lib/action-result";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { assertAnyPermissionWithAudit } from "@/shared/lib/authorization";
import { getUserPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { revokeTagInputSchema } from "@/shared/lib/validators/tags";

import { assertManualTagTargetEligible, assertManuallyManageableTagName } from "../lib/project-tag-guard";

const tagFeedbackMessages = [
  "目标成员不存在。",
  "管理员是治理账号，不能被授予或撤销 Tag。",
  "仅可管理在用成员的 Tag。",
  "Tag 授权不存在或已撤销。",
  "项目组标签由项目流程自动管理，不能手动授予或撤销。",
  "毕业状态由用户状态流程管理，不能手动授予或撤销毕业 Tag。",
  "培养身份系统 Tag 由学位字段自动维护，不能手动授予或撤销。",
  "执行 Tag 操作的账号已失效。",
] as const;

const TAG_MANAGE_PERMISSIONS = [PERMISSIONS.ADMIN_TAG_MANAGE, PERMISSIONS.TAG_REVOKE] as const;

export async function revokeTag(input: unknown) {
  const actor = await requireActiveUser();
  const data = revokeTagInputSchema.parse(input);

  await assertAnyPermissionWithAudit({
    userId: actor.id,
    permissions: TAG_MANAGE_PERMISSIONS,
    entityType: "UserTag",
    entityId: data.userTagId,
  });

  const locatedGrant = await prisma.userTag.findUnique({
    where: { id: data.userTagId },
    select: { userId: true },
  });
  if (!locatedGrant) throw new Error("Tag 授权不存在或已撤销。");

  try {
    await prisma.$transaction(async (tx) => {
      for (const userId of orderUserLifecycleLockIds([actor.id, locatedGrant.userId])) {
        await lockUserLifecycle(tx, userId);
      }
      const now = await getDatabaseNow(tx);
      const [userTag, target, currentActor, currentPermissions] = await Promise.all([
        tx.userTag.findFirst({
          where: { id: data.userTagId, revokedAt: null },
          select: { id: true, userId: true, projectId: true, tag: { select: { name: true } } },
        }),
        tx.user.findUnique({
          where: { id: locatedGrant.userId },
          select: { role: true, status: true },
        }),
        tx.user.findFirst({
          where: { id: actor.id, status: "ACTIVE" },
          select: { displayName: true, studyDegree: true, status: true },
        }),
        getUserPermissionsForClient(tx, actor.id, now),
      ]);
      assertManualTagTargetEligible(target);
      if (!userTag) throw new Error("Tag 授权不存在或已撤销。");
      assertManuallyManageableTagName(userTag.tag.name);
      if (!currentActor) throw new Error("执行 Tag 操作的账号已失效。");
      if (!TAG_MANAGE_PERMISSIONS.some((permission) => currentPermissions.has(permission))) {
        throw new PermissionDeniedError(TAG_MANAGE_PERMISSIONS[0]);
      }
      const actorSnapshot = createActorSnapshot(currentActor, now);
      const updated = await tx.userTag.updateMany({
        where: { id: data.userTagId, revokedAt: null },
        data: {
          revokedAt: now,
          revokedById: actor.id,
          revokerSnapshot: actorSnapshot,
        },
      });
      if (updated.count !== 1) throw new Error("Tag 授权不存在或已撤销。");
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot,
          action: "TAG_REVOKE",
          entityType: "UserTag",
          entityId: userTag.id,
          details: { userId: userTag.userId, tagName: userTag.tag.name, projectId: userTag.projectId },
        },
      });
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: actor.id,
        permission: error.permission,
        entityType: "UserTag",
        entityId: data.userTagId,
      });
    }
    throw error;
  }

  revalidatePath("/admin/tags");
  revalidatePath("/admin/users");
}

export async function revokeTagResult(input: unknown) {
  return toActionResult(async () => {
    await revokeTag(input);
    return null;
  }, {
    fallbackMessage: "Tag 撤销失败，请稍后重试。",
    knownMessages: tagFeedbackMessages,
  });
}
