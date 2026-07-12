import type { Prisma } from "@prisma/client";

import { canWriteProgressReport, getProgressBackfillExpiresAt } from "@/shared/lib/date";
import { getUserPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { getLockedActiveActor, lockUserLifecycle, orderUserLifecycleLockIds } from "@/shared/lib/user-lifecycle-lock";

export type ProgressWriteWindow = {
  allowed: boolean;
  backfillWindowId: string | null;
};

export const SAVE_REPORT_CONSUMES_BACKFILL_WINDOW = false;
export const BACKFILL_WINDOW_USED_MESSAGE = "补填窗口已使用或已过期。";

export async function openProgressBackfillWindowForUser(
  tx: Prisma.TransactionClient,
  input: { managerId: string; userId: string; year: number; month: number },
) {
  for (const userId of orderUserLifecycleLockIds([input.managerId, input.userId])) {
    await lockUserLifecycle(tx, userId);
  }
  const actor = await getLockedActiveActor(tx, input.managerId);
  const [permissions, target] = await Promise.all([
    getUserPermissionsForClient(tx, input.managerId, actor?.now),
    tx.user.findFirst({ where: { id: input.userId, status: "ACTIVE" }, select: { id: true } }),
  ]);
  if (!actor || !permissions.has(PERMISSIONS.PROGRESS_BACKFILL)) {
    throw new PermissionDeniedError(PERMISSIONS.PROGRESS_BACKFILL);
  }
  if (!target) throw new Error("目标成员不存在或账号不可用。");

  const expiresAt = getProgressBackfillExpiresAt(actor.now);
  const window = await tx.progressBackfillWindow.upsert({
    where: { userId_year_month: { userId: input.userId, year: input.year, month: input.month } },
    create: {
      userId: input.userId,
      year: input.year,
      month: input.month,
      openedById: input.managerId,
      expiresAt,
    },
    update: { openedById: input.managerId, expiresAt, usedAt: null },
  });
  await tx.auditLog.create({
    data: {
      userId: input.managerId,
      actorSnapshot: actor.actorSnapshot,
      action: "PROGRESS_BACKFILL",
      entityType: "ProgressBackfillWindow",
      entityId: window.id,
      details: {
        studentUserId: input.userId,
        year: input.year,
        month: input.month,
        expiresAt: expiresAt.toISOString(),
      },
    },
  });
  return window;
}

export async function resolveProgressWriteWindow(
  userId: string,
  year: number,
  month: number,
  client: Pick<Prisma.TransactionClient, "$queryRaw" | "systemSetting" | "progressBackfillWindow"> = prisma,
): Promise<ProgressWriteWindow> {
  const [settings, [{ now }]] = await Promise.all([
    client.systemSetting.findUniqueOrThrow({ where: { id: "singleton" } }),
    client.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
  ]);
  if (canWriteProgressReport(year, month, now, settings)) {
    return { allowed: true, backfillWindowId: null };
  }

  const backfill = await client.progressBackfillWindow.findFirst({
    where: {
      userId,
      year,
      month,
      expiresAt: { gt: now },
      usedAt: null,
    },
    select: { id: true },
  });

  return {
    allowed: Boolean(backfill),
    backfillWindowId: backfill?.id ?? null,
  };
}

export function buildBackfillWindowConsumeWhere(backfillWindowId: string, now = new Date()) {
  return {
    id: backfillWindowId,
    usedAt: null,
    expiresAt: { gt: now },
  };
}

export function assertBackfillWindowConsumed(count: number) {
  if (count !== 1) {
    throw new Error(BACKFILL_WINDOW_USED_MESSAGE);
  }
}

export async function consumeBackfillWindow(
  tx: Prisma.TransactionClient,
  backfillWindowId: string | null,
  now = new Date(),
) {
  if (!backfillWindowId) return;
  const consumed = await tx.progressBackfillWindow.updateMany({
    where: buildBackfillWindowConsumeWhere(backfillWindowId, now),
    data: { usedAt: now },
  });
  assertBackfillWindowConsumed(consumed.count);
}
