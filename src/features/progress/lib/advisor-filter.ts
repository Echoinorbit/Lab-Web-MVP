import type { Prisma } from "@prisma/client";

import { ADVISOR_TAG_NAME } from "@/shared/lib/system-tags";

export { ADVISOR_TAG_NAME };

export type AdvisorTagSnapshot = {
  tags?: readonly {
    revokedAt?: Date | string | null;
    expiresAt?: Date | string | null;
    tag: { name: string };
  }[];
};

function toTime(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function hasEffectiveAdvisorTag(user: AdvisorTagSnapshot, now = new Date()) {
  const nowTime = now.getTime();
  return (user.tags ?? []).some((userTag) => {
    if (userTag.tag.name !== ADVISOR_TAG_NAME) return false;
    if (userTag.revokedAt) return false;
    return !userTag.expiresAt || toTime(userTag.expiresAt) > nowTime;
  });
}

export function withoutEffectiveAdvisorTagWhere(now = new Date()): Prisma.UserWhereInput {
  return {
    NOT: {
      tags: {
        some: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          tag: { name: ADVISOR_TAG_NAME },
        },
      },
    },
  };
}
