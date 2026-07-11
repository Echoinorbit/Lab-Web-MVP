export function parseSystemSettingsTime(value: FormDataEntryValue | null) {
  const match = String(value ?? "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return Number.NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return Number.NaN;
  return hours * 60 + minutes;
}

export function parseSystemSettingsRevision(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return Number.NaN;
  const revision = Number(value);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : Number.NaN;
}
