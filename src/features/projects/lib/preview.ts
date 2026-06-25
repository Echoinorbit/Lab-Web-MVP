export function summarizeProjectDescription(description: string | null | undefined, maxLength = 96) {
  const normalized = (description ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "暂无描述";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}
