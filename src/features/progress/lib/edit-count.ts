export const MAX_SUBMITTED_REPORT_EDITS = 3;

export const SUBMITTED_REPORT_EDIT_LIMIT_MESSAGE = "本月报告提交后修改次数已用完（3/3）";

export function remainingSubmittedReportEdits(editCount: number) {
  return Math.max(0, MAX_SUBMITTED_REPORT_EDITS - editCount);
}

export function assertSubmittedReportEditAllowed(editCount: number) {
  if (remainingSubmittedReportEdits(editCount) <= 0) {
    throw new Error(SUBMITTED_REPORT_EDIT_LIMIT_MESSAGE);
  }
}

export function shouldIncrementSubmittedReportEditCount(status: "DRAFT" | "SUBMITTED" | null | undefined) {
  return status === "SUBMITTED";
}
