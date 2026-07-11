import type { Prisma } from "@prisma/client";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";

import {
  getDatabaseNow,
  lockAdminGovernance,
  lockUserLifecycle,
  orderUserLifecycleLockIds,
} from "./user-lifecycle";

export type DeleteUserMode =
  | { kind: "manual"; actorId: string; confirmUsername: string }
  | { kind: "scheduled" };

export type DeleteUserAccountResult = {
  deleted: boolean;
  avatar: string | null;
  reason: "deleted" | "already_absent" | "not_due";
};

export function getDeletionSnapshotState(mode: DeleteUserMode) {
  return mode.kind === "scheduled" ? "GRADUATED" as const : "DELETED" as const;
}

export function getPurgeResponseStatus(failed: number, avatarCleanupFailed: number) {
  return failed === 0 && avatarCleanupFailed === 0 ? 200 : 207;
}

type DeletionTargetPolicySnapshot = {
  id: string;
  username: string;
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "SUSPENDED" | "GRADUATED";
  studyDegree: "MASTER" | "DOCTOR" | "MENTOR" | null;
  identityNeedsReview: boolean;
  scheduledDeletionAt: Date | null;
};

export function isScheduledUserDeletionDue(target: DeletionTargetPolicySnapshot, now: Date) {
  return target.status === "GRADUATED"
    && !target.identityNeedsReview
    && (target.studyDegree === "MASTER" || target.studyDegree === "DOCTOR")
    && target.scheduledDeletionAt !== null
    && target.scheduledDeletionAt <= now;
}

export function assertManualUserDeletionPolicy(input: {
  actorId: string;
  confirmUsername: string;
  target: DeletionTargetPolicySnapshot;
  activeAdminCount?: number;
}) {
  if (input.actorId === input.target.id) throw new Error("管理员不能删除自己的账号。");
  if (input.confirmUsername !== input.target.username) throw new Error("确认用户名不匹配。");
  if (
    input.target.role === "ADMIN"
    && input.target.status === "ACTIVE"
    && (input.activeAdminCount ?? 0) <= 1
  ) {
    throw new Error("不能删除最后一个有效管理员账号。");
  }
}

export async function deleteUserAccount(
  tx: Prisma.TransactionClient,
  targetUserId: string,
  mode: DeleteUserMode,
): Promise<DeleteUserAccountResult> {
  const lifecycleUserIds = mode.kind === "manual"
    ? [mode.actorId, targetUserId]
    : [targetUserId];
  for (const userId of orderUserLifecycleLockIds(lifecycleUserIds)) {
    await lockUserLifecycle(tx, userId);
  }
  const now = await getDatabaseNow(tx);
  const target = await tx.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatar: true,
      role: true,
      status: true,
      studyDegree: true,
      identityNeedsReview: true,
      scheduledDeletionAt: true,
    },
  });
  if (!target) {
    if (mode.kind === "scheduled") return { deleted: false, avatar: null, reason: "already_absent" };
    throw new Error("用户不存在或已被删除。");
  }

  let actorSnapshot = null;
  if (mode.kind === "manual") {
    const actor = await tx.user.findFirst({
      where: { id: mode.actorId, role: "ADMIN", status: "ACTIVE" },
      select: { displayName: true, studyDegree: true, status: true },
    });
    if (!actor) throw new Error("执行删除的管理员账号已失效。");
    actorSnapshot = createActorSnapshot(actor, now);

    let activeAdminCount: number | undefined;
    if (target.role === "ADMIN" && target.status === "ACTIVE") {
      await lockAdminGovernance(tx);
      activeAdminCount = await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    }
    assertManualUserDeletionPolicy({
      actorId: mode.actorId,
      confirmUsername: mode.confirmUsername,
      target,
      activeAdminCount,
    });
  } else {
    if (!isScheduledUserDeletionDue(target, now)) {
      return { deleted: false, avatar: null, reason: "not_due" };
    }
  }

  const targetSnapshot = createActorSnapshot(target, now, getDeletionSnapshotState(mode));

  await Promise.all([
    tx.user.updateMany({
      where: { advisorId: target.id },
      data: { advisorId: null, advisorSnapshot: targetSnapshot },
    }),
    tx.announcement.updateMany({ where: { authorId: target.id }, data: { authorSnapshot: targetSnapshot } }),
    tx.post.updateMany({ where: { authorId: target.id }, data: { authorSnapshot: targetSnapshot } }),
    tx.comment.updateMany({ where: { authorId: target.id }, data: { authorSnapshot: targetSnapshot } }),
    tx.project.updateMany({ where: { creatorId: target.id }, data: { creatorSnapshot: targetSnapshot } }),
    tx.project.updateMany({ where: { advisorId: target.id }, data: { advisorId: null, advisorSnapshot: targetSnapshot } }),
    tx.project.updateMany({ where: { archivedById: target.id }, data: { archivedBySnapshot: targetSnapshot } }),
    tx.projectMember.updateMany({ where: { userId: target.id }, data: { memberSnapshot: targetSnapshot } }),
    tx.projectNode.updateMany({ where: { authorId: target.id }, data: { authorSnapshot: targetSnapshot } }),
    tx.progressReport.updateMany({ where: { userId: target.id }, data: { userSnapshot: targetSnapshot } }),
    tx.notification.updateMany({ where: { senderId: target.id }, data: { senderSnapshot: targetSnapshot } }),
    tx.auditLog.updateMany({ where: { userId: target.id }, data: { userId: null, actorSnapshot: targetSnapshot } }),
    tx.userTag.updateMany({ where: { grantedById: target.id }, data: { granterSnapshot: targetSnapshot } }),
    tx.userTag.updateMany({ where: { revokedById: target.id }, data: { revokerSnapshot: targetSnapshot } }),
    tx.systemSetting.updateMany({ where: { updatedById: target.id }, data: { updatedBySnapshot: targetSnapshot } }),
  ]);

  await tx.project.updateMany({
    where: {
      leaderId: target.id,
      deletedAt: null,
      archivedAt: null,
      status: { not: "COMPLETED" },
    },
    data: { leaderId: null, leaderSnapshot: targetSnapshot, leaderNeedsReassignment: true },
  });
  await tx.project.updateMany({
    where: { leaderId: target.id },
    data: { leaderId: null, leaderSnapshot: targetSnapshot, leaderNeedsReassignment: false },
  });

  await Promise.all([
    tx.rateLimitCounter.deleteMany({ where: { userId: target.id } }),
    tx.progressBackfillWindow.deleteMany({
      where: { OR: [{ userId: target.id }, { openedById: target.id }] },
    }),
    tx.notification.deleteMany({ where: { userId: target.id } }),
    tx.userTag.deleteMany({ where: { userId: target.id } }),
  ]);
  await tx.user.delete({ where: { id: target.id } });

  await tx.auditLog.create({
    data: {
      userId: mode.kind === "manual" ? mode.actorId : null,
      ...(actorSnapshot ? { actorSnapshot } : {}),
      action: "DELETE",
      entityType: "User",
      entityId: target.id,
      details: {
        reason: mode.kind === "manual" ? "ADMIN_PERMANENT_DELETE" : "GRADUATION_GRACE_EXPIRED",
        target: targetSnapshot,
      },
    },
  });
  return { deleted: true, avatar: target.avatar, reason: "deleted" };
}
