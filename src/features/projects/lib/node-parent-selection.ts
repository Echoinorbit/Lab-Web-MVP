export const PROJECT_NODE_ROOT_PARENT_VALUE = "__root__";

export function normalizeProjectNodeParentInput(value: unknown): string | null | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  if (value === PROJECT_NODE_ROOT_PARENT_VALUE) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}
