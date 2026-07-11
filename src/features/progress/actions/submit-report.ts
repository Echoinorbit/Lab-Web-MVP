"use server";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { progressReportInputSchema } from "@/shared/lib/validators/progress";

import { consumeBackfillWindow, resolveProgressWriteWindow } from "../lib/backfill";
import { MAX_SUBMITTED_REPORT_EDITS, remainingSubmittedReportEdits } from "../lib/edit-count";
import { reportInputFromForm, type ReportFormState } from "../lib/report-form";
import { requireProgressReportWriteAccess, writeProgressReport } from "../lib/report-write";
import { saveProgressReport } from "./save-report";

async function saveAndSubmitProgressReport(input: unknown) {
  const user = await requireActiveUser();
  const data = progressReportInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.PROGRESS_REPORT_WRITE,
    entityType: "ProgressReport",
  });
  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.PROGRESS_REPORT_SUBMIT,
    entityType: "ProgressReport",
  });

  try {
    return await prisma.$transaction(async (tx) => {
      const access = await requireProgressReportWriteAccess(tx, user.id, [
        PERMISSIONS.PROGRESS_REPORT_WRITE,
        PERMISSIONS.PROGRESS_REPORT_SUBMIT,
      ]);
      const writeWindow = await resolveProgressWriteWindow(user.id, data.year, data.month, tx);
      if (!writeWindow.allowed) {
        throw new Error("进度报告不在管理员配置的提交窗口内；历史月份需由管理员开启补填窗口。");
      }
      const report = await writeProgressReport(tx, user.id, data, access.actorSnapshot);
      const submitted = await tx.progressReport.updateMany({
        where: {
          id: report.id,
          userId: user.id,
          year: data.year,
          month: data.month,
          deletedAt: null,
          status: "DRAFT",
        },
        data: { status: "SUBMITTED", submittedAt: access.now },
      });
      if (submitted.count !== 1) {
        throw new Error("只有草稿状态的进度报告可以提交，已提交报告不能重复提交。");
      }

      await consumeBackfillWindow(tx, writeWindow.backfillWindowId, access.now);

      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorSnapshot: access.actorSnapshot,
          action: "UPDATE",
          entityType: "ProgressReport",
          entityId: report.id,
          details: { status: "SUBMITTED", year: data.year, month: data.month },
        },
      });
      return { status: "SUBMITTED" as const, editCount: report.editCount };
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

// Combined progressive-enhancement action for the report form. A submit button
// carries name="intent" with value "save" or "submit"; native form submission
// includes the clicked button's value, so this works without client hydration.
export async function reportFormAction(
  previousState: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const payload = reportInputFromForm(formData);
  try {
    if (formData.get("intent") === "submit") {
      const report = await saveAndSubmitProgressReport(payload);
      return {
        ok: true,
        message: `报告已提交，不能重复提交；仍可保存修改 ${remainingSubmittedReportEdits(report.editCount)} 次。`,
        ...report,
      };
    }
    const report = await saveProgressReport(payload);
    const remaining = report.status === "SUBMITTED"
      ? remainingSubmittedReportEdits(report.editCount)
      : MAX_SUBMITTED_REPORT_EDITS;
    return {
      ok: true,
      message: report.status === "SUBMITTED" ? `修改已保存，剩余可修改 ${remaining} 次。` : "草稿已保存。",
      status: report.status,
      editCount: report.editCount,
    };
  } catch (error) {
    return {
      ...previousState,
      ok: false,
      message: error instanceof Error ? error.message : "操作失败",
    };
  }
}
