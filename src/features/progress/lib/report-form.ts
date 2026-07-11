export type ReportFormState = {
  ok: boolean;
  message: string | null;
  status?: "DRAFT" | "SUBMITTED";
  editCount?: number;
};

export type ProgressWriteMode = "regular" | "backfill" | "closed-current" | "closed-history";

export function describeProgressWriteMode(mode: ProgressWriteMode) {
  switch (mode) {
    case "regular":
      return "当前处于管理员配置的本月填报窗口，可以保存或提交。";
    case "backfill":
      return "管理员已开启 24 小时补填窗口，可以保存或提交；提交后窗口将被消费。";
    case "closed-current":
      return "当前不在管理员配置的填报窗口内，本月报告为只读。";
    case "closed-history":
      return "历史月份默认只读；如需补填，请联系管理员开启 24 小时补填窗口。";
  }
}

export function reportInputFromForm(formData: FormData) {
  return {
    year: Number(formData.get("year")),
    month: Number(formData.get("month")),
    studySummary: String(formData.get("studySummary") ?? ""),
    projectSummary: String(formData.get("projectSummary") ?? ""),
    thesisSummary: String(formData.get("thesisSummary") ?? ""),
    otherWork: String(formData.get("otherWork") ?? ""),
    externalDays: Number(formData.get("externalDays")),
  };
}
