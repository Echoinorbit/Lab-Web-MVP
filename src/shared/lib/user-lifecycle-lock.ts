import { Prisma } from "@prisma/client";

import { createActorSnapshot } from "./actor-snapshot";

export const USER_LIFECYCLE_LOCK_PREFIX = "lab-platform:user-lifecycle:v1:";
export const USER_LIFECYCLE_SET_LOCK_KEY = "lab-platform:user-lifecycle-set:v1";
export const USER_ADVISOR_RELATION_LOCK_KEY = "lab-platform:user-advisor-relation:v1";

export function orderUserLifecycleLockIds(userIds: readonly string[]) {
  return [...new Set(userIds)].sort((left, right) => left.localeCompare(right));
}

async function lockUserLifecycleSetShared(tx: Prisma.TransactionClient) {
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock_shared(hashtextextended(${USER_LIFECYCLE_SET_LOCK_KEY}, 0))
  `);
}

export async function lockAllUserLifecycles(tx: Prisma.TransactionClient) {
  // ponytail: global lock keeps bulk token invalidation deadlock-free; use a session epoch if user volume makes this measurable.
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${USER_LIFECYCLE_SET_LOCK_KEY}, 0))
  `);
}

export async function lockUserAdvisorRelations(tx: Prisma.TransactionClient) {
  // ponytail: advisor rewrites are rare, so one global relation lock is safer than maintaining a dynamic lock graph.
  await lockUserLifecycleSetShared(tx);
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${USER_ADVISOR_RELATION_LOCK_KEY}, 0))
  `);
}

export async function lockUserLifecycle(tx: Prisma.TransactionClient, userId: string) {
  await lockUserLifecycleSetShared(tx);
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${USER_LIFECYCLE_LOCK_PREFIX + userId}, 0))
  `);
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`);
}

export async function getLockedActor(tx: Prisma.TransactionClient, userId: string) {
  await lockUserLifecycle(tx, userId);
  const [[{ now }], actor] = await Promise.all([
    tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT transaction_timestamp() AS now`),
    tx.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        status: true,
        displayName: true,
        studyDegree: true,
        identityNeedsReview: true,
        advisorId: true,
      },
    }),
  ]);
  if (!actor) return null;
  return { actor, now, actorSnapshot: createActorSnapshot(actor, now) };
}

export async function getLockedActiveActor(tx: Prisma.TransactionClient, userId: string) {
  const access = await getLockedActor(tx, userId);
  return access?.actor.status === "ACTIVE" ? access : null;
}
