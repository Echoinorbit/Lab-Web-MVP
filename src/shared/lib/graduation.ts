import { computeGrade, resolveGradeTrackFromTagNames } from "./grade";
import type { UserStatusName } from "./user-status";

export type GraduationTagSnapshot = {
  projectId?: string | null;
  tag: { name: string };
};

export type GraduationUserSnapshot = {
  status: UserStatusName;
  enrollmentDate?: Date | string | null;
  tags: readonly GraduationTagSnapshot[];
};

export type EffectiveUserTagWhere = {
  userId: string;
  revokedAt: null;
  OR: [{ expiresAt: null }, { expiresAt: { gt: Date } }];
};

export type GraduationTransaction = {
  user: {
    updateMany(args: {
      where: { id: string; status: { not: "GRADUATED" } };
      data: { status: "GRADUATED"; tokenVersion: { increment: 1 } };
    }): PromiseLike<{ count: number }>;
  };
  userTag: {
    updateMany(args: { where: EffectiveUserTagWhere; data: { revokedAt: Date } }): PromiseLike<{ count: number }>;
  };
};

export function shouldGraduateByComputedGrade(user: GraduationUserSnapshot, now = new Date()) {
  if (user.status !== "ACTIVE" || !user.enrollmentDate) return false;
  const tagNames = user.tags.filter((userTag) => !userTag.projectId).map((userTag) => userTag.tag.name);
  const track = resolveGradeTrackFromTagNames(tagNames);
  if (!track) return false;
  return computeGrade(track, new Date(user.enrollmentDate), now) === null;
}

export function effectiveUserTagWhere(userId: string, now: Date): EffectiveUserTagWhere {
  return {
    userId,
    revokedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

export async function revokeEffectiveUserTags(tx: Pick<GraduationTransaction, "userTag">, userId: string, now: Date) {
  return tx.userTag.updateMany({
    where: effectiveUserTagWhere(userId, now),
    data: { revokedAt: now },
  });
}

export async function graduateUserAccount(tx: GraduationTransaction, userId: string, now = new Date()) {
  const result = await tx.user.updateMany({
    where: { id: userId, status: { not: "GRADUATED" } },
    data: { status: "GRADUATED", tokenVersion: { increment: 1 } },
  });
  if (result.count === 1) {
    await revokeEffectiveUserTags(tx, userId, now);
  }
  return result;
}
