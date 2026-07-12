import { PERMISSIONS, type Permission } from "@/shared/lib/permissions";

import { PROJECT_REACTIVATION_ADVISOR_REQUIRED_MESSAGE } from "./project-responsibility";

export const PROJECT_UNARCHIVE_COOLDOWN_HOURS = 168;
export const PROJECT_UNARCHIVE_COOLDOWN_MS = PROJECT_UNARCHIVE_COOLDOWN_HOURS * 60 * 60 * 1000;

export function getProjectUnarchiveAvailableAt(archivedAt: Date | string) {
  const archivedTime = archivedAt instanceof Date ? archivedAt.getTime() : new Date(archivedAt).getTime();
  return new Date(archivedTime + PROJECT_UNARCHIVE_COOLDOWN_MS);
}

export function getProjectUnarchiveRemainingMs(archivedAt: Date | string, now = new Date()) {
  return Math.max(0, getProjectUnarchiveAvailableAt(archivedAt).getTime() - now.getTime());
}

export function canUnarchiveProjectAt(archivedAt: Date | string, now = new Date()) {
  return getProjectUnarchiveRemainingMs(archivedAt, now) === 0;
}

export function assertProjectCanArchiveStatus(status: string) {
  if (status !== "PLANNING" && status !== "IN_PROGRESS") {
    throw new Error("只有规划中或进行中的项目可以归档。");
  }
}

export function resolveProjectArchiveAccess(input: {
  actorId: string;
  actorCanLead: boolean;
  leaderId: string | null;
  globalPermissions: ReadonlySet<Permission>;
  projectPermissions: ReadonlySet<Permission>;
}) {
  if (input.actorCanLead && input.leaderId === input.actorId) {
    return { allowed: true as const, scope: "leader" as const };
  }
  if (input.globalPermissions.has(PERMISSIONS.PROJECT_ARCHIVE_ANY)) {
    return { allowed: true as const, scope: "admin" as const };
  }
  if (input.projectPermissions.has(PERMISSIONS.PROJECT_MANAGE)) {
    return { allowed: true as const, scope: "project" as const };
  }
  return { allowed: false as const };
}

export function assertProjectCanUnarchive(
  status: string,
  archivedAt: Date | string | null,
  advisorEligible: boolean,
  now = new Date(),
) {
  if (status !== "ARCHIVED" || !archivedAt) {
    throw new Error("只有已归档的项目可以重新启用。");
  }
  if (!advisorEligible) throw new Error(PROJECT_REACTIVATION_ADVISOR_REQUIRED_MESSAGE);
  if (!canUnarchiveProjectAt(archivedAt, now)) {
    throw new Error("归档后 7 天内不可重新启用");
  }
}

export function formatProjectArchiveRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分`;
  if (minutes > 0) return `${minutes}分${seconds}秒`;
  return `${seconds}秒`;
}
