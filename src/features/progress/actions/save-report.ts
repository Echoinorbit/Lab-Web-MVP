"use server";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { progressReportInputSchema } from "@/shared/lib/validators/progress";

import { resolveProgressWriteWindow } from "../lib/backfill";
import { requireProgressReportWriteAccess, writeProgressReport } from "../lib/report-write";

export async function saveProgressReport(input: unknown) {
  const user = await requireActiveUser();
  const data = progressReportInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.PROGRESS_REPORT_WRITE,
    entityType: "ProgressReport",
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const access = await requireProgressReportWriteAccess(tx, user.id, [PERMISSIONS.PROGRESS_REPORT_WRITE]);
      const writeWindow = await resolveProgressWriteWindow(user.id, data.year, data.month, tx);
      if (!writeWindow.allowed) {
        throw new Error("进度报告不在管理员配置的填报窗口内；历史月份需由管理员开启补填窗口。");
      }
      // Saving remains gated by the current/backfill window but intentionally does
      // not consume the one-use backfill token; submit consumes it transactionally.
      return writeProgressReport(tx, user.id, data, access.actorSnapshot);
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: user.id,
        permission: error.permission,
        entityType: "ProgressReport",
      });
    }
    throw error;
  }
}
