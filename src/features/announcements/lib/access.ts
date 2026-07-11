import { PERMISSIONS, type Permission, type RoleName } from "@/shared/lib/permissions";

export const ANNOUNCEMENT_LIST_ROUTE = "/announcements";
export const ANNOUNCEMENT_CREATE_ROUTE = "/announcements/new";
export const ANNOUNCEMENT_ENTITY_TYPE = "Announcement";
export const ANNOUNCEMENT_CREATE_PERMISSION = PERMISSIONS.ANNOUNCEMENT_CREATE;

export function resolveAnnouncementUpdateAccess(input: {
  actorId: string;
  actorRole: RoleName;
  authorId: string | null;
  permissions: ReadonlySet<Permission>;
}) {
  if (!input.permissions.has(PERMISSIONS.ANNOUNCEMENT_UPDATE)) return { allowed: false as const };
  if (input.actorRole === "ADMIN") return { allowed: true as const, scope: "admin" as const };
  if (input.authorId === input.actorId) return { allowed: true as const, scope: "author" as const };
  return { allowed: false as const };
}
