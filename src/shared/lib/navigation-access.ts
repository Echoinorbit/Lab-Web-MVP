import { PERMISSIONS, type Permission } from "./permissions";

export const NAVIGATION_ITEM_KEYS = [
  "home",
  "announcements",
  "posts",
  "projects",
  "progress",
  "notifications",
  "admin-users",
  "admin-tags",
  "admin-audit",
  "admin-settings",
] as const;

export type NavigationItemKey = (typeof NAVIGATION_ITEM_KEYS)[number];

export type NavigationAccessMap = Record<NavigationItemKey, boolean>;

const NAVIGATION_REQUIRED_PERMISSIONS: Partial<Record<NavigationItemKey, readonly Permission[]>> = {
  progress: [PERMISSIONS.PROGRESS_REPORT_WRITE, PERMISSIONS.PROGRESS_REPORT_SUBMIT, PERMISSIONS.PROGRESS_REPORT_READ_ALL],
  "admin-users": [PERMISSIONS.ADMIN_USER_MANAGE],
  "admin-tags": [PERMISSIONS.ADMIN_TAG_MANAGE],
  "admin-audit": [PERMISSIONS.ADMIN_AUDIT_VIEW],
  "admin-settings": [PERMISSIONS.ADMIN_SETTINGS],
};

export function buildNavigationAccess(permissions: ReadonlySet<Permission>): NavigationAccessMap {
  return Object.fromEntries(
    NAVIGATION_ITEM_KEYS.map((key) => {
      const requiredPermissions = NAVIGATION_REQUIRED_PERMISSIONS[key];
      return [
        key,
        requiredPermissions ? requiredPermissions.some((permission) => permissions.has(permission)) : true,
      ];
    }),
  ) as NavigationAccessMap;
}
