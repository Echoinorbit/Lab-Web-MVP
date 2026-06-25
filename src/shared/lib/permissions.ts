import { prisma } from "./prisma";
import type { UserStatusName } from "./user-status";

export const PERMISSIONS = {
  ANNOUNCEMENT_READ: "announcement.read",
  POST_READ: "post.read",
  PROJECT_READ: "project.read",
  COMMENT_READ: "comment.read",
  ANNOUNCEMENT_CREATE: "announcement.create",
  ANNOUNCEMENT_UPDATE: "announcement.update",
  ANNOUNCEMENT_DELETE: "announcement.delete",
  ANNOUNCEMENT_NOTIFY_TARGETED: "announcement.notify_targeted",
  POST_CREATE: "post.create",
  POST_UPDATE_OWN: "post.update_own",
  POST_DELETE_OWN: "post.delete_own",
  POST_DELETE_ANY: "post.delete_any",
  COMMENT_CREATE: "comment.create",
  COMMENT_DELETE_OWN: "comment.delete_own",
  COMMENT_DELETE_ANY: "comment.delete_any",
  PROJECT_CREATE: "project.create",
  PROJECT_MANAGE: "project.manage",
  PROJECT_MEMBER_MANAGE: "project.member.manage",
  PROJECT_NODE_CREATE: "project.node.create",
  PROGRESS_REPORT_WRITE: "progress.report.write",
  PROGRESS_REPORT_SUBMIT: "progress.report.submit",
  PROGRESS_REPORT_READ_ALL: "progress.report.read_all",
  PROGRESS_EXPORT: "progress.export",
  PROGRESS_BACKFILL: "progress.backfill",
  TAG_REQUEST: "tag.request",
  TAG_APPROVE: "tag.approve",
  TAG_REVOKE: "tag.revoke",
  ADMIN_USER_MANAGE: "admin.user.manage",
  ADMIN_TAG_MANAGE: "admin.tag.manage",
  ADMIN_AUDIT_VIEW: "admin.audit.view",
  ADMIN_SETTINGS: "admin.settings",
  ADMIN_DASHBOARD: "admin.dashboard",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type RoleName = "ADMIN" | "MEMBER";
const KNOWN_PERMISSIONS = new Set<string>(Object.values(PERMISSIONS));

export const CONTENT_AUTHOR_PERMISSIONS = [
  PERMISSIONS.POST_CREATE,
  PERMISSIONS.POST_UPDATE_OWN,
  PERMISSIONS.POST_DELETE_OWN,
  PERMISSIONS.COMMENT_CREATE,
  PERMISSIONS.COMMENT_DELETE_OWN,
] as const satisfies readonly Permission[];

export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  ADMIN: [
    PERMISSIONS.ANNOUNCEMENT_READ,
    PERMISSIONS.POST_READ,
    PERMISSIONS.PROJECT_READ,
    PERMISSIONS.COMMENT_READ,
    PERMISSIONS.PROGRESS_REPORT_READ_ALL,
    PERMISSIONS.ANNOUNCEMENT_UPDATE,
    PERMISSIONS.ANNOUNCEMENT_DELETE,
    PERMISSIONS.ANNOUNCEMENT_NOTIFY_TARGETED,
    PERMISSIONS.POST_DELETE_ANY,
    PERMISSIONS.COMMENT_DELETE_ANY,
    PERMISSIONS.TAG_APPROVE,
    PERMISSIONS.TAG_REVOKE,
    PERMISSIONS.ADMIN_USER_MANAGE,
    PERMISSIONS.ADMIN_TAG_MANAGE,
    PERMISSIONS.ADMIN_AUDIT_VIEW,
    PERMISSIONS.ADMIN_SETTINGS,
    PERMISSIONS.ADMIN_DASHBOARD,
  ],
  MEMBER: [PERMISSIONS.TAG_REQUEST],
};

export type PermissionTagSnapshot = {
  tag: {
    name: string;
    permissions: unknown;
    template?: { permissions: unknown } | null;
  };
  projectId?: string | null;
  expiresAt?: Date | string | null;
  revokedAt?: Date | string | null;
};

export type EffectiveTag = {
  name: string;
  projectId: string | null;
};

export type PermissionUserSnapshot = {
  role: RoleName;
  status: UserStatusName;
  tags: readonly PermissionTagSnapshot[];
} | null;

export function normalizePermissionList(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Permission => typeof item === "string" && KNOWN_PERMISSIONS.has(item));
}

function resolveTagPermissions(userTag: PermissionTagSnapshot) {
  if (Array.isArray(userTag.tag.permissions)) {
    return normalizePermissionList(userTag.tag.permissions);
  }
  if (Array.isArray(userTag.tag.template?.permissions)) {
    return normalizePermissionList(userTag.tag.template.permissions);
  }
  return [];
}

export function isEffectiveTag(tag: PermissionTagSnapshot, now = new Date()) {
  if (tag.revokedAt) return false;
  if (!tag.expiresAt) return true;
  return new Date(tag.expiresAt).getTime() > now.getTime();
}

export function computePermissionsFromSnapshot(
  user: PermissionUserSnapshot,
  now = new Date(),
) {
  const permissions = new Set<Permission>();
  // SUSPENDED and GRADUATED users intentionally receive zero effective permissions.
  if (!user || user.status !== "ACTIVE") return permissions;

  for (const permission of ROLE_PERMISSIONS[user.role]) {
    permissions.add(permission);
  }

  for (const userTag of user.tags) {
    if (userTag.projectId) continue;
    if (!isEffectiveTag(userTag, now)) continue;
    for (const permission of resolveTagPermissions(userTag)) permissions.add(permission);
  }

  return permissions;
}

export function computeProjectPermissionsFromSnapshot(
  user: PermissionUserSnapshot,
  projectId: string,
  now = new Date(),
) {
  const permissions = new Set<Permission>();
  // SUSPENDED and GRADUATED users intentionally receive zero project permissions.
  if (!user || user.status !== "ACTIVE") return permissions;

  for (const userTag of user.tags) {
    if (userTag.projectId !== projectId) continue;
    if (!isEffectiveTag(userTag, now)) continue;
    for (const permission of resolveTagPermissions(userTag)) permissions.add(permission);
  }

  return permissions;
}

export async function getUserPermissions(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      status: true,
      tags: {
        where: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          projectId: true,
          expiresAt: true,
          revokedAt: true,
          tag: {
            select: {
              name: true,
              permissions: true,
              template: { select: { permissions: true } },
            },
          },
        },
      },
    },
  });

  return computePermissionsFromSnapshot(user);
}

export async function getEffectiveTagNames(userId: string) {
  const tags = await getEffectiveTags(userId);
  return tags.map((tag) => tag.name);
}

export async function getEffectiveTags(userId: string): Promise<EffectiveTag[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      tags: {
        where: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          projectId: true,
          tag: { select: { name: true } },
        },
      },
    },
  });
  if (!user || user.status !== "ACTIVE") return [];
  return user.tags.map((userTag) => ({ name: userTag.tag.name, projectId: userTag.projectId }));
}

export async function assertPermission(userId: string, permission: Permission) {
  const permissions = await getUserPermissions(userId);
  if (!permissions.has(permission)) {
    throw new PermissionDeniedError(permission);
  }
}

export async function getProjectPermissions(userId: string, projectId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      status: true,
      tags: {
        where: {
          projectId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          projectId: true,
          expiresAt: true,
          revokedAt: true,
          tag: {
            select: {
              name: true,
              permissions: true,
              template: { select: { permissions: true } },
            },
          },
        },
      },
    },
  });

  return computeProjectPermissionsFromSnapshot(user, projectId);
}

export async function assertProjectPermission(userId: string, permission: Permission, projectId: string) {
  const permissions = await getProjectPermissions(userId, projectId);
  if (!permissions.has(permission)) {
    throw new PermissionDeniedError(permission);
  }
}

export class PermissionDeniedError extends Error {
  constructor(public readonly permission: Permission) {
    super(`Missing required permission: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}
