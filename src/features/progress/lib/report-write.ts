import type { Prisma } from "@prisma/client";
import type { z } from "zod";

import { createActorSnapshot, type ActorSnapshotV1 } from "@/shared/lib/actor-snapshot";
import {
  getUserPermissionsForClient,
  type Permission,
  PermissionDeniedError,
} from "@/shared/lib/permissions";
import type { progressReportInputSchema } from "@/shared/lib/validators/progress";

import { assertSubmittedReportEditAllowed, shouldIncrementSubmittedReportEditCount } from "./edit-count";

export type ProgressReportInput = z.infer<typeof progressReportInputSchema>;

export function buildProgressReportWriteLockKey(userId: string, year: number, month: number) {
  return `progress-report:${userId}:${year}:${month}`;
}

async function lockProgressReportWrite(
  tx: Prisma.TransactionClient,
  userId: string,
  data: ProgressReportInput,
) {
  const lockKey = buildProgressReportWriteLockKey(userId, data.year, data.month);
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0::bigint))
  `;
}

export async function requireProgressReportWriteAccess(
  tx: Prisma.TransactionClient,
  userId: string,
  requiredPermissions: readonly Permission[],
) {
  const [[{ now }], actor] = await Promise.all([
    tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
    tx.user.findFirst({
      where: { id: userId, status: "ACTIVE" },
      select: { displayName: true, studyDegree: true, status: true },
    }),
  ]);
  const permissions = await getUserPermissionsForClient(tx, userId, now);
  const missingPermission = requiredPermissions.find((permission) => !permissions.has(permission));
  if (!actor || missingPermission) {
    throw new PermissionDeniedError(missingPermission ?? requiredPermissions[0]!);
  }
  return { now, actorSnapshot: createActorSnapshot(actor, now) };
}

export async function writeProgressReport(
  tx: Prisma.TransactionClient,
  userId: string,
  data: ProgressReportInput,
  actorSnapshot: ActorSnapshotV1,
) {
  await lockProgressReportWrite(tx, userId, data);

  const existing = await tx.progressReport.findFirst({
    where: {
      userId,
      year: data.year,
      month: data.month,
      deletedAt: null,
    },
    select: { id: true, status: true, editCount: true },
  });

  const shouldIncrementEditCount = shouldIncrementSubmittedReportEditCount(existing?.status);
  if (shouldIncrementEditCount) {
    assertSubmittedReportEditAllowed(existing.editCount);
  }

  const reportData = {
    studySummary: data.studySummary,
    projectSummary: data.projectSummary,
    thesisSummary: data.thesisSummary,
    otherWork: data.otherWork,
    externalDays: data.externalDays,
  };

  const report = existing
    ? await tx.progressReport.update({
        where: { id: existing.id },
        data: shouldIncrementEditCount
          ? { ...reportData, userSnapshot: actorSnapshot, editCount: { increment: 1 } }
          : { ...reportData, userSnapshot: actorSnapshot },
      })
    : await tx.progressReport.create({
        data: {
          userId,
          userSnapshot: actorSnapshot,
          year: data.year,
          month: data.month,
          ...reportData,
        },
      });

  await tx.auditLog.create({
    data: {
      userId,
      actorSnapshot,
      action: "UPDATE",
      entityType: "ProgressReport",
      entityId: report.id,
      details: { year: data.year, month: data.month },
    },
  });

  return report;
}
