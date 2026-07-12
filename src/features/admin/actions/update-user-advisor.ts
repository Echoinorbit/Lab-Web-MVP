"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { reconcileCanonicalProjectLeadershipForUser } from "@/features/projects/lib/project-responsibility";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { lockUserAdvisorRelations, orderUserLifecycleLockIds } from "@/shared/lib/user-lifecycle-lock";
import { updateUserAdvisorInputSchema } from "@/shared/lib/validators/admin";

import { lockUserIdentity } from "../lib/study-identity-service";
import { canAssignAdvisorToTarget } from "../lib/user-governance";
import { getDatabaseNow } from "../lib/user-lifecycle";
import { toUserActionResult } from "../lib/user-action-result";

export async function updateUserAdvisor(input: unknown) {
  const admin = await requireActiveUser();
  const data = updateUserAdvisorInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  await prisma.$transaction(async (tx) => {
    await lockUserAdvisorRelations(tx);
    const currentRelation = await tx.user.findUnique({
      where: { id: data.userId },
      select: { advisorId: true },
    });
    for (const userId of orderUserLifecycleLockIds([
      admin.id,
      data.userId,
      ...(currentRelation?.advisorId ? [currentRelation.advisorId] : []),
      ...(data.advisorId ? [data.advisorId] : []),
    ])) {
      await lockUserIdentity(tx, userId);
    }
    const [target, currentAdmin, now] = await Promise.all([
      tx.user.findUniqueOrThrow({
        where: { id: data.userId },
        select: {
          role: true,
          status: true,
          studyDegree: true,
          identityNeedsReview: true,
          advisorId: true,
        },
      }),
      tx.user.findFirst({
        where: { id: admin.id, role: "ADMIN", status: "ACTIVE" },
        select: { displayName: true, studyDegree: true, status: true },
      }),
      getDatabaseNow(tx),
    ]);
    if (!currentAdmin) throw new Error("执行导师变更的管理员账号已失效。");
    if (target.status !== "ACTIVE") throw new Error("仅可为在用成员设置导师。");
    if (target.identityNeedsReview) throw new Error("请先修复该账号的培养身份。");
    if (!canAssignAdvisorToTarget({ role: target.role, hasAdvisorTag: target.studyDegree === "MENTOR" })) {
      throw new Error("管理员和导师账号不需要设置导师。");
    }
    const advisor = data.advisorId
      ? await tx.user.findFirst({
        where: {
          id: data.advisorId,
          role: "MEMBER",
          status: "ACTIVE",
          studyDegree: "MENTOR",
          identityNeedsReview: false,
        },
        select: { id: true, displayName: true, studyDegree: true, status: true },
      })
      : null;
    if (data.advisorId && !advisor) throw new Error("所选导师不存在或导师资格已失效。");
    const actorSnapshot = createActorSnapshot(currentAdmin, now);
    await tx.user.update({
      where: { id: data.userId },
      data: {
        advisorId: advisor?.id ?? null,
        advisorSnapshot: advisor ? createActorSnapshot(advisor, now) : Prisma.DbNull,
      },
    });
    const releasedProjectLeaderIds = await reconcileCanonicalProjectLeadershipForUser(tx, {
      userId: data.userId,
      now,
      revokedBy: { id: admin.id, snapshot: actorSnapshot },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        actorSnapshot,
        action: "ADVISOR_CHANGE",
        entityType: "User",
        entityId: data.userId,
        details: {
          beforeAdvisorId: target.advisorId,
          advisorId: advisor?.id ?? null,
          releasedProjectLeaderIds,
        },
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${data.userId}/edit`);
}

export async function updateUserAdvisorResult(input: unknown) {
  return toUserActionResult(async () => {
    await updateUserAdvisor(input);
    return null;
  }, "导师关系更新失败，请稍后重试。");
}
