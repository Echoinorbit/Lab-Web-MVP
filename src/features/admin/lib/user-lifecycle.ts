import { Prisma, type StudyDegree } from "@prisma/client";

import { reconcileCanonicalProjectLeadershipForUser } from "@/features/projects/lib/project-responsibility";
import { createActorSnapshot, type ActorSnapshotV1 } from "@/shared/lib/actor-snapshot";
import { studyDegreeTagName } from "@/shared/lib/study-identity";
import { lockUserLifecycle, orderUserLifecycleLockIds } from "@/shared/lib/user-lifecycle-lock";

export const ADMIN_GOVERNANCE_LOCK_KEY = "lab-platform:admin-governance:v1";
export const GRADUATION_GRACE_HOURS = 72;

export function isResolvedStudentIdentity<T extends {
  role: "ADMIN" | "MEMBER";
  studyDegree: StudyDegree | null;
  identityNeedsReview: boolean;
}>(input: T): input is T & {
  role: "MEMBER";
  studyDegree: "MASTER" | "DOCTOR";
  identityNeedsReview: false;
} {
  return input.role === "MEMBER"
    && !input.identityNeedsReview
    && (input.studyDegree === "MASTER" || input.studyDegree === "DOCTOR");
}

export function getScheduledDeletionAt(graduatedAt: Date) {
  return new Date(graduatedAt.getTime() + GRADUATION_GRACE_HOURS * 60 * 60 * 1000);
}

export async function lockAdminGovernance(tx: Prisma.TransactionClient) {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${ADMIN_GOVERNANCE_LOCK_KEY}, 0))
  `);
}

export async function getDatabaseNow(tx: Prisma.TransactionClient) {
  const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>(
    Prisma.sql`SELECT transaction_timestamp() AS now`,
  );
  return now;
}

type LifecycleTagTransaction = Pick<Prisma.TransactionClient, "tag" | "userTag">;

export async function revokeTagsForGraduation(
  tx: LifecycleTagTransaction,
  input: { userId: string; actorId: string; actorSnapshot: ActorSnapshotV1; now: Date },
) {
  await tx.userTag.updateMany({
    where: { userId: input.userId, revokedAt: null },
    data: {
      revokedAt: input.now,
      revokedById: input.actorId,
      revokerSnapshot: input.actorSnapshot,
    },
  });
  const graduatedTag = await tx.tag.findFirstOrThrow({
    where: { name: "graduated", scope: "GLOBAL", isSystem: true },
    select: { id: true },
  });
  await tx.userTag.create({
    data: {
      userId: input.userId,
      tagId: graduatedTag.id,
      source: "MANUAL",
      grantedById: input.actorId,
      granterSnapshot: input.actorSnapshot,
    },
  });
}

export async function restoreStudyIdentityAfterCancelledGraduation(
  tx: LifecycleTagTransaction,
  input: {
    userId: string;
    actorId: string;
    actorSnapshot: ActorSnapshotV1;
    now: Date;
    studyDegree: "MASTER" | "DOCTOR";
  },
) {
  await tx.userTag.updateMany({
    where: {
      userId: input.userId,
      revokedAt: null,
      projectId: null,
      tag: { name: "graduated" },
    },
    data: {
      revokedAt: input.now,
      revokedById: input.actorId,
      revokerSnapshot: input.actorSnapshot,
    },
  });
  const identityTag = await tx.tag.findFirstOrThrow({
    where: {
      name: studyDegreeTagName(input.studyDegree),
      scope: "GLOBAL",
      isSystem: true,
    },
    select: { id: true },
  });
  await tx.userTag.create({
    data: {
      userId: input.userId,
      tagId: identityTag.id,
      source: "STUDY_IDENTITY",
      grantedById: input.actorId,
      granterSnapshot: input.actorSnapshot,
    },
  });
}

async function getLockedLifecycleUser(tx: Prisma.TransactionClient, userId: string, actorId: string) {
  for (const lifecycleUserId of orderUserLifecycleLockIds([actorId, userId])) {
    await lockUserLifecycle(tx, lifecycleUserId);
  }
  return tx.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      role: true,
      status: true,
      studyDegree: true,
      identityNeedsReview: true,
    },
  });
}

export async function graduateUser(
  tx: Prisma.TransactionClient,
  input: { userId: string; actorId: string },
) {
  const target = await getLockedLifecycleUser(tx, input.userId, input.actorId);
  if (!target) throw new Error("用户不存在。");
  if (!isResolvedStudentIdentity(target)) throw new Error("只有身份已确认的硕士或博士成员可以毕业。");
  if (target.status === "GRADUATED") throw new Error("该账号已经进入毕业清理期。");

  const now = await getDatabaseNow(tx);
  const scheduledDeletionAt = getScheduledDeletionAt(now);
  const actor = await tx.user.findFirst({
    where: { id: input.actorId, role: "ADMIN", status: "ACTIVE" },
    select: { displayName: true, studyDegree: true, status: true },
  });
  if (!actor) throw new Error("执行毕业操作的管理员账号已失效。");
  const actorSnapshot = createActorSnapshot(actor, now);

  await tx.user.update({
    where: { id: target.id },
    data: {
      status: "GRADUATED",
      graduatedAt: now,
      scheduledDeletionAt,
      tokenVersion: { increment: 1 },
    },
  });

  await revokeTagsForGraduation(tx, {
    userId: target.id,
    actorId: input.actorId,
    actorSnapshot,
    now,
  });
  const releasedProjectLeaderIds = await reconcileCanonicalProjectLeadershipForUser(tx, {
    userId: target.id,
    now,
    revokedBy: { id: input.actorId, snapshot: actorSnapshot },
  });

  await tx.auditLog.create({
    data: {
      userId: input.actorId,
      actorSnapshot,
      action: "STATUS_CHANGE",
      entityType: "User",
      entityId: target.id,
      details: {
        status: "GRADUATED",
        graduatedAt: now.toISOString(),
        scheduledDeletionAt: scheduledDeletionAt.toISOString(),
        releasedProjectLeaderIds,
      },
    },
  });
  return { graduatedAt: now, scheduledDeletionAt };
}

export async function cancelUserGraduation(
  tx: Prisma.TransactionClient,
  input: { userId: string; actorId: string },
) {
  const target = await getLockedLifecycleUser(tx, input.userId, input.actorId);
  if (!target) throw new Error("用户不存在。");
  if (target.status !== "GRADUATED") throw new Error("该账号不在毕业清理期。");
  if (!isResolvedStudentIdentity(target)) throw new Error("该账号的培养身份不允许取消毕业。");

  const now = await getDatabaseNow(tx);
  const actor = await tx.user.findFirst({
    where: { id: input.actorId, role: "ADMIN", status: "ACTIVE" },
    select: { displayName: true, studyDegree: true, status: true },
  });
  if (!actor) throw new Error("执行取消毕业的管理员账号已失效。");
  const actorSnapshot = createActorSnapshot(actor, now);
  await tx.user.update({
    where: { id: target.id },
    data: {
      status: "ACTIVE",
      graduatedAt: null,
      scheduledDeletionAt: null,
      tokenVersion: { increment: 1 },
    },
  });
  await restoreStudyIdentityAfterCancelledGraduation(tx, {
    userId: target.id,
    actorId: input.actorId,
    actorSnapshot,
    now,
    studyDegree: target.studyDegree,
  });
  await tx.auditLog.create({
    data: {
      userId: input.actorId,
      actorSnapshot,
      action: "STATUS_CHANGE",
      entityType: "User",
      entityId: target.id,
      details: { status: "ACTIVE", cancelledGraduationAt: now.toISOString() },
    },
  });
}
