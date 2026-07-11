"use server";

import { revalidatePath } from "next/cache";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { revokeUserSessionsInputSchema } from "@/shared/lib/validators/admin";

import { getDatabaseNow, lockUserLifecycle } from "../lib/user-lifecycle";

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
    await lockUserLifecycle(tx, data.userId);
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
