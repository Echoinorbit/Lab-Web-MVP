import { Prisma, type Role, type StudyDegree, type StudyGrade } from "@prisma/client";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { assertStudyIdentity, studyDegreeTagName } from "@/shared/lib/study-identity";
import { lockUserLifecycle, orderUserLifecycleLockIds } from "@/shared/lib/user-lifecycle-lock";

export type CanonicalStudyIdentity = {
  role: Role;
  studyDegree: StudyDegree | null;
  studyGrade: StudyGrade | null;
};

export async function lockUserIdentity(tx: Prisma.TransactionClient, userId: string) {
  // Identity, lifecycle, role, and deletion mutations share one per-user lock.
  // Using a second advisory-lock namespace would allow stale pre-lock reads and
  // can deadlock when a role transition and an identity edit cross each other.
  await lockUserLifecycle(tx, userId);
}

export async function syncStudyIdentity(
  tx: Prisma.TransactionClient,
  input: CanonicalStudyIdentity & { userId: string; actorId: string },
) {
  assertStudyIdentity(input);
  for (const userId of orderUserLifecycleLockIds([input.actorId, input.userId])) {
    await lockUserIdentity(tx, userId);
  }
  const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT transaction_timestamp() AS now`);
  const actor = await tx.user.findFirst({
    where: { id: input.actorId, role: "ADMIN", status: "ACTIVE" },
    select: { displayName: true, studyDegree: true, status: true },
  });
  if (!actor) throw new Error("执行培养身份变更的管理员账号已失效。");
  const actorSnapshot = createActorSnapshot(actor, now);

  await tx.user.update({
    where: { id: input.userId },
    data: {
      role: input.role,
      studyDegree: input.studyDegree,
      studyGrade: input.studyGrade,
      identityNeedsReview: false,
      identityMigrationNote: null,
      ...(input.role === "ADMIN" || input.studyDegree === "MENTOR"
        ? { advisorId: null, advisorSnapshot: Prisma.DbNull }
        : {}),
    },
  });

  await tx.userTag.updateMany({
    where: {
      userId: input.userId,
      revokedAt: null,
      projectId: null,
      tag: { name: { in: ["grad-master", "grad-phd", "advisor"] } },
    },
    data: { revokedAt: now, revokedById: input.actorId, revokerSnapshot: actorSnapshot },
  });

  if (input.role === "ADMIN" || !input.studyDegree) return { actorSnapshot, now };
  const tag = await tx.tag.findFirstOrThrow({
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
      tagId: tag.id,
      grantedById: input.actorId,
      granterSnapshot: actorSnapshot,
      source: "STUDY_IDENTITY",
    },
  });
  return { actorSnapshot, now };
}
