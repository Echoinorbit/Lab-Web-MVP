export type ReportFormState = { ok: boolean; message: string | null };

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
