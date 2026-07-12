"use server";

import { revalidatePath } from "next/cache";

import {
  assertNoActiveProjectAdvisorResponsibilities,
  getProjectAdvisorLifecycleUserIds,
  reconcileCanonicalProjectLeadershipForAdvisor,
  reconcileCanonicalProjectLeadershipForUser,
} from "@/features/projects/lib/project-responsibility";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import {
  lockUserAdvisorRelations,
  lockUserLifecycle,
  orderUserLifecycleLockIds,
} from "@/shared/lib/user-lifecycle-lock";
import { updateUserRoleInputSchema } from "@/shared/lib/validators/admin";

import { applyAdminUserRoleUpdate } from "../lib/user-governance";
import {
  getDatabaseNow,
  lockAdminGovernance,
} from "../lib/user-lifecycle";
import { toUserActionResult } from "../lib/user-action-result";

export async function updateUserRole(input: unknown) {
  const admin = await requireActiveUser();
  const data = updateUserRoleInputSchema.parse(input);
  if (admin.id === data.userId && data.role !== "ADMIN") {
    throw new Error("管理员不能移除自己的管理员角色。");
  }

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  await prisma.$transaction(async (tx) => {
    await lockUserAdvisorRelations(tx);
    const relatedUserIds = await getProjectAdvisorLifecycleUserIds(tx, data.userId);
    for (const userId of orderUserLifecycleLockIds([admin.id, data.userId, ...relatedUserIds])) {
      await lockUserLifecycle(tx, userId);
    }
    await lockAdminGovernance(tx);
    const target = await tx.user.findUnique({
      where: { id: data.userId },
      select: { role: true, status: true, studyDegree: true },
    });
    if (!target) throw new Error("用户不存在。");
    if (target.role === data.role) throw new Error("用户角色未发生变化。");
    if (target.status === "GRADUATED") throw new Error("毕业账号不能直接变更系统角色。");
    if (data.role === "ADMIN") {
      await assertNoActiveProjectAdvisorResponsibilities(tx, data.userId);
    }
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
    const actorSnapshot = createActorSnapshot(actor, now);
    await applyAdminUserRoleUpdate(tx, {
      adminId: admin.id,
      userId: data.userId,
      role: data.role,
      now,
      actorSnapshot,
    });
    if (target.studyDegree === "MENTOR" && data.role === "ADMIN") {
      await reconcileCanonicalProjectLeadershipForAdvisor(tx, {
        advisorId: data.userId,
        now,
        revokedBy: { id: admin.id, snapshot: actorSnapshot },
      });
    }
    await reconcileCanonicalProjectLeadershipForUser(tx, {
      userId: data.userId,
      now,
      revokedBy: { id: admin.id, snapshot: actorSnapshot },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${data.userId}/edit`);
  revalidatePath("/admin/tags");
}

export async function updateUserRoleResult(input: unknown) {
  return toUserActionResult(async () => {
    await updateUserRole(input);
    return null;
  }, "系统角色更新失败，请稍后重试。");
}
