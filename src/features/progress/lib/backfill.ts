import type { Prisma } from "@prisma/client";

import { canWriteProgressReport } from "@/shared/lib/date";
import { prisma } from "@/shared/lib/prisma";

export type ProgressWriteWindow = {
  allowed: boolean;
  backfillWindowId: string | null;
};

export const SAVE_REPORT_CONSUMES_BACKFILL_WINDOW = false;
export const BACKFILL_WINDOW_USED_MESSAGE = "补填窗口已使用或已过期。";

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
