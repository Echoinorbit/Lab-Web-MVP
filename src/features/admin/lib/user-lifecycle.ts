import { Prisma, type StudyDegree } from "@prisma/client";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";

export const USER_LIFECYCLE_LOCK_PREFIX = "lab-platform:user-lifecycle:v1:";
export const ADMIN_GOVERNANCE_LOCK_KEY = "lab-platform:admin-governance:v1";
export const GRADUATION_GRACE_HOURS = 72;

export function isResolvedStudentIdentity(input: {
  role: "ADMIN" | "MEMBER";
  studyDegree: StudyDegree | null;
  identityNeedsReview: boolean;
}) {
  return input.role === "MEMBER"
    && !input.identityNeedsReview
    && (input.studyDegree === "MASTER" || input.studyDegree === "DOCTOR");
}

export function getScheduledDeletionAt(graduatedAt: Date) {
  return new Date(graduatedAt.getTime() + GRADUATION_GRACE_HOURS * 60 * 60 * 1000);
}

export async function lockUserLifecycle(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${USER_LIFECYCLE_LOCK_PREFIX + userId}, 0))
  `);
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`);
}

export async function lockAdminGovernance(tx: Prisma.TransactionClient) {
  await tx.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${ADMIN_GOVERNANCE_LOCK_KEY}, 0))
  `);
}

export async function getDatabaseNow(tx: Prisma.TransactionClient) {
  const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>(
    Prisma.sql`SELECT transaction_timestamp() AS now`,
  );
  return now;
}

async function getLockedLifecycleUser(tx: Prisma.TransactionClient, userId: string) {
  await lockUserLifecycle(tx, userId);
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
  const target = await getLockedLifecycleUser(tx, input.userId);
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

  const graduatedTag = await tx.tag.findFirstOrThrow({
    where: { name: "graduated", scope: "GLOBAL", isSystem: true },
    select: { id: true },
  });
  const existingMarker = await tx.userTag.findFirst({
    where: { userId: target.id, tagId: graduatedTag.id, projectId: null, revokedAt: null },
    select: { id: true },
  });
  if (!existingMarker) {
    await tx.userTag.create({
      data: {
        userId: target.id,
        tagId: graduatedTag.id,
        source: "MANUAL",
        grantedById: input.actorId,
        granterSnapshot: actorSnapshot,
      },
    });
  }

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
      },
    },
  });
  return { graduatedAt: now, scheduledDeletionAt };
}

export async function cancelUserGraduation(
  tx: Prisma.TransactionClient,
  input: { userId: string; actorId: string },
) {
  const target = await getLockedLifecycleUser(tx, input.userId);
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
  await tx.userTag.updateMany({
    where: {
      userId: target.id,
      revokedAt: null,
      projectId: null,
      tag: { name: "graduated" },
    },
    data: { revokedAt: now, revokedById: input.actorId, revokerSnapshot: actorSnapshot },
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
