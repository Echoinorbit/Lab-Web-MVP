"use server";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { progressReportInputSchema } from "@/shared/lib/validators/progress";

import { resolveProgressWriteWindow } from "../lib/backfill";
import { writeProgressReport } from "../lib/report-write";

export async function saveProgressReport(input: unknown) {
  const user = await requireActiveUser();
  const data = progressReportInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.PROGRESS_REPORT_WRITE,
    entityType: "ProgressReport",
  });

  const writeWindow = await resolveProgressWriteWindow(user.id, data.year, data.month);
  if (!writeWindow.allowed) {
    throw new Error("进度报告仅可在北京时间每月 25–27 日编辑；历史月份需由管理员开启补填窗口。");
  }
  // Saving remains gated by the current/backfill window but intentionally does
  // not consume the one-use backfill token; submit consumes it transactionally.

  return prisma.$transaction((tx) => writeProgressReport(tx, user.id, data));
}
