"use server";

import { revalidatePath } from "next/cache";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { revokeUserSessionsInputSchema } from "@/shared/lib/validators/admin";

import { getDatabaseNow, lockUserLifecycle, orderUserLifecycleLockIds } from "../lib/user-lifecycle";
import { toUserActionResult } from "../lib/user-action-result";

export async function revokeUserSessions(input: unknown) {
  const admin = await requireActiveUser();
  const data = revokeUserSessionsInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  await prisma.$transaction(async (tx) => {
    for (const userId of orderUserLifecycleLockIds([admin.id, data.userId])) {
      await lockUserLifecycle(tx, userId);
    }
    const [currentAdmin, now] = await Promise.all([
      tx.user.findFirst({
        where: { id: admin.id, role: "ADMIN", status: "ACTIVE" },
        select: { displayName: true, studyDegree: true, status: true },
      }),
      getDatabaseNow(tx),
    ]);
    if (!currentAdmin) throw new Error("执行会话吊销的管理员账号已失效。");
    await tx.user.update({
      where: { id: data.userId },
      data: { tokenVersion: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        actorSnapshot: createActorSnapshot(currentAdmin, now),
        action: "SESSION_REVOKE",
        entityType: "User",
        entityId: data.userId,
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${data.userId}/edit`);
}

export async function revokeUserSessionsResult(input: unknown) {
  return toUserActionResult(async () => {
    await revokeUserSessions(input);
    return null;
  }, "吊销用户会话失败，请稍后重试。");
}
