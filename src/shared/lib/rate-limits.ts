import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";
import { getShanghaiDayWindowStart } from "./date";
import { getEffectiveTagNames } from "./permissions";

export type RateLimitRule = {
  max: number | null;
  window: "1d";
};

export const RATE_LIMITS: Record<string, Record<string, RateLimitRule>> = {
  "post.create": {
    "grad-master": { max: 5, window: "1d" },
    "grad-phd": { max: 10, window: "1d" },
    advisor: { max: null, window: "1d" },
  },
  "announcement.create": {
    advisor: { max: 20, window: "1d" },
  },
};

const DEFAULT_RATE_LIMITS: Partial<Record<string, RateLimitRule>> = {
  "post.create": { max: 5, window: "1d" },
};

export type RateLimitSelection =
  | { kind: "unlimited" }
  | { kind: "limited"; max: number }
  | { kind: "denied" };

export type RateLimitResult =
  | { kind: "unlimited"; allowed: true; remaining: null; max: null }
  | { kind: "limited"; allowed: boolean; remaining: number; max: number }
  | { kind: "denied"; allowed: false; remaining: 0; max: 0 };

export function selectRateLimit(action: string, tagNames: readonly string[]): RateLimitSelection {
  const limits = RATE_LIMITS[action];
  if (!limits) return { kind: "unlimited" };

  let maxAllowed = 0;
  for (const tagName of tagNames) {
    const limit = limits[tagName];
    if (!limit) continue;
    if (limit.max === null) return { kind: "unlimited" };
    maxAllowed = Math.max(maxAllowed, limit.max);
  }

  if (maxAllowed > 0) return { kind: "limited", max: maxAllowed };

  const defaultLimit = DEFAULT_RATE_LIMITS[action];
  if (defaultLimit) {
    return defaultLimit.max === null ? { kind: "unlimited" } : { kind: "limited", max: defaultLimit.max };
  }

  return { kind: "denied" };
}

export function resolveRateLimitResult(selection: RateLimitSelection, count: number): RateLimitResult {
  if (selection.kind === "unlimited") {
    return { kind: "unlimited", allowed: true, remaining: null, max: null };
  }
  if (selection.kind === "denied") {
    return { kind: "denied", allowed: false, remaining: 0, max: 0 };
  }

  return {
    kind: "limited",
    allowed: count <= selection.max,
    remaining: Math.max(selection.max - count, 0),
    max: selection.max,
  };
}

export class RateLimitExceededError extends Error {
  constructor(public readonly result: RateLimitResult) {
    super("操作频率已达到上限。");
    this.name = "RateLimitExceededError";
  }
}

async function getEffectiveTagNamesInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      tags: {
        where: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: { tag: { select: { name: true } } },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") return [];
  return user.tags.map((userTag) => userTag.tag.name);
}

export async function enforceRateLimit(
  tx: Prisma.TransactionClient,
  userId: string,
  action: string,
  now = new Date(),
) {
  const tagNames = await getEffectiveTagNamesInTransaction(tx, userId, now);
  const selection = selectRateLimit(action, tagNames);

  if (selection.kind !== "limited") {
    const result = resolveRateLimitResult(selection, 0);
    if (!result.allowed) throw new RateLimitExceededError(result);
    return result;
  }

  const windowStart = getShanghaiDayWindowStart(now);
  const counter = await tx.rateLimitCounter.upsert({
    where: {
      userId_action_windowStart: {
        userId,
        action,
        windowStart,
      },
    },
    create: {
      userId,
      action,
      windowStart,
      count: 1,
    },
    update: {
      count: { increment: 1 },
    },
    select: { count: true },
  });
  const result = resolveRateLimitResult(selection, counter.count);
  if (!result.allowed) throw new RateLimitExceededError(result);
  return result;
}

export async function getRateLimitStatus(userId: string, action: string): Promise<RateLimitResult> {
  const tagNames = await getEffectiveTagNames(userId);
  const selection = selectRateLimit(action, tagNames);
  if (selection.kind !== "limited") return resolveRateLimitResult(selection, 0);

  const windowStart = getShanghaiDayWindowStart();
  const counter = await prisma.rateLimitCounter.findUnique({
    where: {
      userId_action_windowStart: {
        userId,
        action,
        windowStart,
      },
    },
    select: { count: true },
  });

  return resolveRateLimitResult(selection, counter?.count ?? 0);
}
