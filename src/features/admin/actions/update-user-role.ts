"use server";

import { revalidatePath } from "next/cache";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { updateUserRoleInputSchema } from "@/shared/lib/validators/admin";

import { applyAdminUserRoleUpdate } from "../lib/user-governance";
import { getDatabaseNow, lockAdminGovernance, lockUserLifecycle } from "../lib/user-lifecycle";

export async function updateUserRole(input: unknown) {
  const admin = await requireActiveUser();
  const data = updateUserRoleInputSchema.parse(input);
  if (admin.id === data.userId && data.role !== "ADMIN") {
    throw new Error("Admins cannot remove their own admin role.");
  }

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  await prisma.$transaction(async (tx) => {
    await lockUserLifecycle(tx, data.userId);
    await lockAdminGovernance(tx);
    const target = await tx.user.findUnique({
      where: { id: data.userId },
      select: { role: true, status: true },
    });
    if (!target) throw new Error("用户不存在。");
    if (target.role === data.role) throw new Error("用户角色未发生变化。");
    if (target.status === "GRADUATED") throw new Error("毕业账号不能直接变更系统角色。");
    if (target.role === "ADMIN" && data.role === "MEMBER" && target.status === "ACTIVE") {
      const activeAdminCount = await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
      if (activeAdminCount <= 1) throw new Error("不能移除最后一个有效管理员的角色。");
    }
    const [now, actor] = await Promise.all([
      getDatabaseNow(tx),
      tx.user.findFirst({
        where: { id: admin.id, role: "ADMIN", status: "ACTIVE" },
        select: { displayName: true, studyDegree: true, status: true },
      }),
    ]);
    if (!actor) throw new Error("执行角色变更的管理员账号已失效。");
    await applyAdminUserRoleUpdate(tx, {
      adminId: admin.id,
      userId: data.userId,
      role: data.role,
      now,
      actorSnapshot: createActorSnapshot(actor, now),
    });
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${data.userId}/edit`);
  revalidatePath("/admin/tags");
}
