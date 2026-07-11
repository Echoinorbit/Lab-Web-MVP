"use server";

import { revalidatePath } from "next/cache";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { updateUserStatusInputSchema } from "@/shared/lib/validators/admin";

import { getDatabaseNow, graduateUser, lockAdminGovernance, lockUserLifecycle } from "../lib/user-lifecycle";

export async function updateUserStatus(input: unknown) {
  const admin = await requireActiveUser();
  const data = updateUserStatusInputSchema.parse(input);
  if (admin.id === data.userId && data.status !== "ACTIVE") {
    throw new Error("管理员不能停用或毕业自己的账号。");
  }

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  await prisma.$transaction(async (tx) => {
    if (data.status === "GRADUATED") {
      await graduateUser(tx, { actorId: admin.id, userId: data.userId });
      return;
    }

    await lockUserLifecycle(tx, data.userId);
    const target = await tx.user.findUnique({
      where: { id: data.userId },
      select: { id: true, role: true, status: true },
    });
    if (!target) throw new Error("用户不存在。");
    if (target.status === "GRADUATED") throw new Error("请先使用取消毕业流程恢复该账号。");
    if (target.role === "ADMIN" && target.status === "ACTIVE" && data.status === "SUSPENDED") {
      await lockAdminGovernance(tx);
      const activeAdminCount = await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
      if (activeAdminCount <= 1) throw new Error("不能停用最后一个有效管理员账号。");
    }
    const [now, currentAdmin] = await Promise.all([
      getDatabaseNow(tx),
      tx.user.findFirst({
        where: { id: admin.id, role: "ADMIN", status: "ACTIVE" },
        select: { displayName: true, studyDegree: true, status: true },
      }),
    ]);
    if (!currentAdmin) throw new Error("执行状态变更的管理员账号已失效。");
    const actorSnapshot = createActorSnapshot(currentAdmin, now);
    await tx.user.update({
      where: { id: target.id },
      data: {
        status: data.status,
        tokenVersion: { increment: data.status === "SUSPENDED" ? 1 : 0 },
      },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        actorSnapshot,
        action: "STATUS_CHANGE",
        entityType: "User",
        entityId: target.id,
        details: { status: data.status, changedAt: now.toISOString() },
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${data.userId}/edit`);
  revalidatePath("/admin/tags");
}
