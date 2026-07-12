import type { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";

import {
  formatActorDisplayName,
  getActorDisplayAccountState,
  resolveActorDisplay,
} from "@/shared/lib/actor-snapshot";
import { isBearerSecretAuthorized } from "@/shared/lib/cron-auth";
import { getShanghaiDateParts } from "@/shared/lib/date";

export type AuditExportCounterSnapshot = {
  exportsInYear: number;
  cycleCount: number;
};

export type AuditLogExportRow = {
  createdAt: Date;
  userId: string | null;
  actorName: string;
  actorState: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  details: unknown;
};

export function isAuditCronAuthorized(input: {
  authorizationHeader?: string | null;
  secret?: string | null;
}) {
  return isBearerSecretAuthorized(input);
}

export function buildAuditExportContentDisposition(fileName: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function formatShanghaiDateForFileName(date: Date) {
  const parts = getShanghaiDateParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getShanghaiYearEnd(year: number) {
  return new Date(Date.UTC(year, 11, 31, 15, 59, 59, 999));
}

export function resolveAuditExportRangeStart(input: {
  previousRangeEnd?: Date | null;
  earliestLogCreatedAt?: Date | null;
  now: Date;
}) {
  return input.previousRangeEnd ?? input.earliestLogCreatedAt ?? input.now;
}

export function buildAuditExportPlan(input: {
  counter: AuditExportCounterSnapshot;
  rangeStart: Date;
  rangeEnd: Date;
  now: Date;
}) {
  const year = getShanghaiDateParts(input.now).year;
  const seqInYear = input.counter.exportsInYear + 1;
  const incrementedCycleCount = input.counter.cycleCount + 1;
  const shouldClearAuditLogs = incrementedCycleCount >= 4;

  return {
    year,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    seqInYear,
    fileName: `audit_export_${formatShanghaiDateForFileName(input.now)}_seq${seqInYear}.xlsx`,
    expiresAt: getShanghaiYearEnd(year),
    exportsInYear: seqInYear,
    cycleCount: shouldClearAuditLogs ? 0 : incrementedCycleCount,
    shouldClearAuditLogs,
  };
}

export async function executeAuditExport(tx: Prisma.TransactionClient, now = new Date()) {
  const year = getShanghaiDateParts(now).year;
  const counter = await tx.auditExportCounter.upsert({
    where: { year },
    create: { year },
    update: {},
    select: { exportsInYear: true, cycleCount: true },
  });
  const latestArchive = await tx.auditExportArchive.findFirst({
    orderBy: { rangeEnd: "desc" },
    select: { rangeEnd: true },
  });
  const earliestLog = latestArchive
    ? null
    : await tx.auditLog.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const rangeStart = resolveAuditExportRangeStart({
    previousRangeEnd: latestArchive?.rangeEnd ?? null,
    earliestLogCreatedAt: earliestLog?.createdAt ?? null,
    now,
  });
  const logs = await tx.auditLog.findMany({
    where: { createdAt: { gte: rangeStart, lt: now } },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      userId: true,
      actorSnapshot: true,
      action: true,
      entityType: true,
      entityId: true,
      ipAddress: true,
      details: true,
    },
  });
  const users = await tx.user.findMany({
    where: { id: { in: logs.flatMap((log) => log.userId ? [log.userId] : []) } },
    select: { id: true, displayName: true, status: true },
  });
  const userById = new Map(users.map((user) => [user.id, user]));
  const plan = buildAuditExportPlan({ counter, rangeStart, rangeEnd: now, now });
  const excelData = await buildAuditWorkbookBuffer(logs.map(({ actorSnapshot, ...log }) => {
    const actor = resolveActorDisplay(log.userId ? userById.get(log.userId) : null, actorSnapshot);
    return {
      ...log,
      actorName: formatActorDisplayName(actor),
      actorState: getActorDisplayAccountState(actor),
    };
  }));

  await tx.auditExportArchive.create({
    data: {
      fileName: plan.fileName,
      excelData,
      seqInYear: plan.seqInYear,
      rangeStart: plan.rangeStart,
      rangeEnd: plan.rangeEnd,
      rowCount: logs.length,
      expiresAt: plan.expiresAt,
    },
  });
  await tx.auditExportCounter.update({
    where: { year },
    data: {
      exportsInYear: plan.exportsInYear,
      cycleCount: plan.cycleCount,
      lastExportAt: now,
    },
  });
  if (plan.shouldClearAuditLogs) {
    await tx.auditLog.deleteMany({ where: { createdAt: { lt: plan.rangeEnd } } });
  }
  await tx.auditExportArchive.deleteMany({ where: { expiresAt: { lt: now } } });

  return {
    fileName: plan.fileName,
    rowCount: logs.length,
    cycleCount: plan.cycleCount,
    seqInYear: plan.seqInYear,
  };
}

export async function buildAuditWorkbookBuffer(rows: readonly AuditLogExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("audit_logs");
  sheet.addRow(["createdAt", "userId", "actorName", "actorState", "action", "entityType", "entityId", "ipAddress", "details"]);
  for (const row of rows) {
    sheet.addRow([
      row.createdAt.toISOString(),
      row.userId ?? "",
      row.actorName,
      row.actorState,
      row.action,
      row.entityType,
      row.entityId ?? "",
      row.ipAddress ?? "",
      row.details == null ? "" : JSON.stringify(row.details),
    ]);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
