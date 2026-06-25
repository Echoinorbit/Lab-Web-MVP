"use server";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { progressReportInputSchema } from "@/shared/lib/validators/progress";

import { consumeBackfillWindow, resolveProgressWriteWindow } from "../lib/backfill";
import { reportInputFromForm, type ReportFormState } from "../lib/report-form";
import { writeProgressReport } from "../lib/report-write";
import { saveProgressReport } from "./save-report";

export async function submitProgressReport(year: number, month: number) {
  const user = await requireActiveUser();
  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.PROGRESS_REPORT_SUBMIT,
    entityType: "ProgressReport",
  });

  const writeWindow = await resolveProgressWriteWindow(user.id, year, month);
  if (!writeWindow.allowed) {
    throw new Error("Progress reports can only be submitted during the 25-27 Shanghai-time window.");
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const report = await tx.progressReport.findFirstOrThrow({
      where: {
        userId: user.id,
        year,
        month,
        deletedAt: null,
        status: "DRAFT",
      },
      select: { id: true },
    });

    await tx.progressReport.update({
      where: { id: report.id },
      data: { status: "SUBMITTED", submittedAt: now },
    });
    await consumeBackfillWindow(tx, writeWindow.backfillWindowId, now);

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        entityType: "ProgressReport",
        entityId: report.id,
        details: { status: "SUBMITTED", year, month },
      },
    });
  });
}

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

  const writeWindow = await resolveProgressWriteWindow(user.id, data.year, data.month);
  if (!writeWindow.allowed) {
    throw new Error("Progress reports can only be submitted during the 25-27 Shanghai-time window.");
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const report = await writeProgressReport(tx, user.id, data);
    const submitted = await tx.progressReport.updateMany({
      where: {
        id: report.id,
        userId: user.id,
        year: data.year,
        month: data.month,
        deletedAt: null,
        status: "DRAFT",
      },
      data: { status: "SUBMITTED", submittedAt: now },
    });
    if (submitted.count !== 1) {
      throw new Error("Only draft progress reports can be submitted.");
    }

    await consumeBackfillWindow(tx, writeWindow.backfillWindowId, now);

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        entityType: "ProgressReport",
        entityId: report.id,
        details: { status: "SUBMITTED", year: data.year, month: data.month },
      },
    });
  });
}

// Combined progressive-enhancement action for the report form. A submit button
// carries name="intent" with value "save" or "submit"; native form submission
// includes the clicked button's value, so this works without client hydration.
export async function reportFormAction(
  _prevState: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const payload = reportInputFromForm(formData);
  try {
    if (formData.get("intent") === "submit") {
      await saveAndSubmitProgressReport(payload);
      return { ok: true, message: "已提交" };
    }
    await saveProgressReport(payload);
    return { ok: true, message: "草稿已保存" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "操作失败" };
  }
}
