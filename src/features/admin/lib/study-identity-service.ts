import { Prisma, type Role, type StudyDegree, type StudyGrade, type UserStatus } from "@prisma/client";

import {
  assertNoActiveProjectAdvisorResponsibilities,
  reconcileCanonicalProjectLeadershipForAdvisor,
  reconcileCanonicalProjectLeadershipForUser,
} from "@/features/projects/lib/project-responsibility";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { enrollmentDateForGrade } from "@/shared/lib/grade";
import { assertStudyIdentity, studyDegreeTagName } from "@/shared/lib/study-identity";
import { STUDY_GRADE_LABELS } from "@/shared/lib/study-identity";
import { lockUserLifecycle, orderUserLifecycleLockIds } from "@/shared/lib/user-lifecycle-lock";

import { getScheduledDeletionAt } from "./user-lifecycle";

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

export async function releaseFormerMentorResponsibilities(
  tx: Prisma.TransactionClient,
  input: {
    advisorId: string;
    advisor: {
      displayName: string;
      studyDegree: StudyDegree | null;
      status: UserStatus;
    };
    now: Date;
    revokedBy: { id: string; snapshot: ReturnType<typeof createActorSnapshot> };
  },
) {
  const adviseeIds = (await tx.user.findMany({
    where: { advisorId: input.advisorId },
    select: { id: true },
    orderBy: { id: "asc" },
  })).map(({ id }) => id);
  const advisorSnapshot = createActorSnapshot(input.advisor, input.now);
  const releasedAdviseeCount = (await tx.user.updateMany({
    where: { advisorId: input.advisorId },
    data: { advisorId: null, advisorSnapshot },
  })).count;
  const reconciledProjectIds = await reconcileCanonicalProjectLeadershipForAdvisor(tx, {
    advisorId: input.advisorId,
    now: input.now,
    revokedBy: input.revokedBy,
  });
  for (const userId of adviseeIds) {
    reconciledProjectIds.push(...await reconcileCanonicalProjectLeadershipForUser(tx, {
      userId,
      now: input.now,
      revokedBy: input.revokedBy,
    }));
  }
  return {
    releasedAdviseeCount,
    reconciledProjectIds: [...new Set(reconciledProjectIds)],
  };
}

export async function syncStudyIdentity(
  tx: Prisma.TransactionClient,
  input: CanonicalStudyIdentity & {
    userId: string;
    actorId: string;
    repairGraduationClock?: boolean;
  },
) {
  assertStudyIdentity(input);
  for (const userId of orderUserLifecycleLockIds([input.actorId, input.userId])) {
    await lockUserIdentity(tx, userId);
  }
  const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT transaction_timestamp() AS now`);
  const [actor, currentTarget] = await Promise.all([
    tx.user.findFirst({
      where: { id: input.actorId, role: "ADMIN", status: "ACTIVE" },
      select: { displayName: true, studyDegree: true, status: true },
    }),
    tx.user.findUnique({
      where: { id: input.userId },
      select: { displayName: true, studyDegree: true, status: true },
    }),
  ]);
  if (!actor) throw new Error("执行培养身份变更的管理员账号已失效。");
  if (
    currentTarget?.studyDegree === "MENTOR"
    && (input.role !== "MEMBER" || input.studyDegree !== "MENTOR")
  ) {
    await assertNoActiveProjectAdvisorResponsibilities(tx, input.userId);
  }
  const actorSnapshot = createActorSnapshot(actor, now);
  const releasedMentorResponsibilities = currentTarget?.studyDegree === "MENTOR"
    && (input.role !== "MEMBER" || input.studyDegree !== "MENTOR")
    ? await releaseFormerMentorResponsibilities(tx, {
        advisorId: input.userId,
        advisor: currentTarget,
        now,
        revokedBy: { id: input.actorId, snapshot: actorSnapshot },
      })
    : { releasedAdviseeCount: 0, reconciledProjectIds: [] };

  // GRADUATED + identityNeedsReview=false 行必须在同一条语句里满足
  // User_graduation_contract_check 的 72 小时删除契约。
  await tx.user.update({
    where: { id: input.userId },
    data: {
      role: input.role,
      studyDegree: input.studyDegree,
      studyGrade: input.studyGrade,
      identityNeedsReview: false,
      identityMigrationNote: null,
      ...(input.repairGraduationClock
        ? { graduatedAt: now, scheduledDeletionAt: getScheduledDeletionAt(now) }
        : {}),
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

  const releasedLeaderProjectIds = await reconcileCanonicalProjectLeadershipForUser(tx, {
    userId: input.userId,
    now,
    revokedBy: { id: input.actorId, snapshot: actorSnapshot },
  });
  const reconciledProjectIds = [...new Set([
    ...releasedMentorResponsibilities.reconciledProjectIds,
    ...releasedLeaderProjectIds,
  ])];

  if (input.role === "ADMIN" || !input.studyDegree) {
    return {
      actorSnapshot,
      now,
      reconciledProjectIds,
      releasedAdviseeCount: releasedMentorResponsibilities.releasedAdviseeCount,
    };
  }
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
  return {
    actorSnapshot,
    now,
    reconciledProjectIds,
    releasedAdviseeCount: releasedMentorResponsibilities.releasedAdviseeCount,
  };
}

export async function applyStudyIdentityUpdate(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    actorId: string;
    studyDegree: StudyDegree;
    studyGrade?: StudyGrade | null;
    confirmGraduatedRepair?: boolean;
  },
) {
  const target = await tx.user.findUnique({
    where: { id: input.userId },
    select: {
      role: true,
      status: true,
      studyDegree: true,
      studyGrade: true,
      identityNeedsReview: true,
    },
  });
  if (!target) throw new Error("用户不存在。");
  if (target.role !== "MEMBER") throw new Error("管理员账号不能设置培养身份。");
  const repairingGraduatedIdentity = target.status === "GRADUATED" && target.identityNeedsReview;
  if (target.status === "GRADUATED" && !repairingGraduatedIdentity) {
    throw new Error("请先取消毕业，再修改培养身份。");
  }
  if (repairingGraduatedIdentity && input.confirmGraduatedRepair !== true) {
    throw new Error("修复毕业账号的培养身份前必须确认继续毕业清理。");
  }
  if (repairingGraduatedIdentity && input.studyDegree === "MENTOR") {
    throw new Error("毕业账号只能修复为硕士或博士身份。");
  }

  const studyGrade = input.studyGrade ?? null;
  const enrollmentDate = studyGrade
    ? enrollmentDateForGrade(
        input.studyDegree === "MASTER" ? "master" : "phd",
        STUDY_GRADE_LABELS[studyGrade],
      )
    : null;
  const identitySync = await syncStudyIdentity(tx, {
    userId: input.userId,
    actorId: input.actorId,
    role: "MEMBER",
    studyDegree: input.studyDegree,
    studyGrade,
    repairGraduationClock: repairingGraduatedIdentity,
  });
  const repairedGraduation = repairingGraduatedIdentity
    ? {
        graduatedAt: identitySync.now,
        scheduledDeletionAt: getScheduledDeletionAt(identitySync.now),
      }
    : null;
  await tx.user.update({
    where: { id: input.userId },
    data: { enrollmentDate },
  });
  return {
    target,
    studyGrade,
    identitySync,
    repairedGraduation,
    repairingGraduatedIdentity,
  };
}
