"use server";

import ExcelJS from "exceljs";

import { appendAuditLog } from "@/shared/lib/audit";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

import { withoutEffectiveAdvisorTagWhere } from "../lib/advisor-filter";

export async function exportProgressReports(year: number, month: number) {
  const user = await requireActiveUser();
  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.PROGRESS_EXPORT,
    entityType: "ProgressReport",
  });

  const reports = await prisma.progressReport.findMany({
    where: { year, month, deletedAt: null, user: withoutEffectiveAdvisorTagWhere() },
    include: { user: { include: { advisor: true } } },
    orderBy: [{ user: { grade: "asc" } }, { user: { studentId: "asc" } }],
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`${year}-${String(month).padStart(2, "0")}`);
  sheet.addRow(["年级", "姓名", "学号", "导师", "学习总结", "项目工作总结", "论文工作总结", "其他工作内容", "外出天数", "初评", "最终"]);
  for (const report of reports) {
    sheet.addRow([
      report.user.grade ?? "",
      report.user.displayName,
      report.user.studentId ?? "",
      report.user.advisor?.displayName ?? "",
      report.studySummary ?? "",
      report.projectSummary ?? "",
      report.thesisSummary ?? "",
      report.otherWork ?? "",
      report.externalDays,
      "",
      "",
    ]);
  }

  await appendAuditLog({
    userId: user.id,
    action: "EXPORT",
    entityType: "ProgressReport",
    details: { year, month, rows: reports.length },
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString("base64");
}
