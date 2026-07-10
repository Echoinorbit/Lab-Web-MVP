import type { ProjectStatus } from "@prisma/client";

export function deriveProjectStatus(input: {
  archivedAt: Date | string | null;
  currentStatus: ProjectStatus;
  activeNodeCount: number;
}): ProjectStatus {
  if (input.archivedAt) return "ARCHIVED";
  if (input.currentStatus === "COMPLETED") return "COMPLETED";
  return input.activeNodeCount > 0 ? "IN_PROGRESS" : "PLANNING";
}

export function canArchiveProjectStatus(status: ProjectStatus) {
  return status === "PLANNING" || status === "IN_PROGRESS";
}
