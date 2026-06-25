import { timingSafeEqual } from "node:crypto";

import ExcelJS from "exceljs";

import { getShanghaiDateParts } from "@/shared/lib/date";

export type AuditExportCounterSnapshot = {
  exportsInYear: number;
  cycleCount: number;
};

export type AuditLogExportRow = {
  createdAt: Date;
  userId: string | null;
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
  if (!input.secret) return false;
  const prefix = "Bearer ";
  if (!input.authorizationHeader?.startsWith(prefix)) return false;
  const token = input.authorizationHeader.slice(prefix.length);
  const tokenBuffer = Buffer.from(token);
  const secretBuffer = Buffer.from(input.secret);
  if (tokenBuffer.length !== secretBuffer.length) return false;
  return timingSafeEqual(tokenBuffer, secretBuffer);
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

export async function buildAuditWorkbookBuffer(rows: readonly AuditLogExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("audit_logs");
  sheet.addRow(["createdAt", "userId", "action", "entityType", "entityId", "ipAddress", "details"]);
  for (const row of rows) {
    sheet.addRow([
      row.createdAt.toISOString(),
      row.userId ?? "",
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
