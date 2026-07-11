import type { Prisma } from "@prisma/client";

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
  PROJECT_CREATE_ON_BEHALF: "project.create_on_behalf",
  PROJECT_MANAGE: "project.manage",
  PROJECT_ARCHIVE_ANY: "project.archive_any",
  PROJECT_UPDATE_ADVISED: "project.update_advised",
  PROJECT_DELETE_ADVISED: "project.delete_advised",
  PROJECT_DELETE_ANY: "project.delete_any",
  PROJECT_RESTORE: "project.restore",
  PROJECT_MEMBER_MANAGE: "project.member.manage",
  PROJECT_NODE_CREATE: "project.node.create",
  PROGRESS_REPORT_WRITE: "progress.report.write",
  PROGRESS_REPORT_SUBMIT: "progress.report.submit",
  PROGRESS_REPORT_READ_ALL: "progress.report.read_all",
  PROGRESS_REPORT_READ_ADVISEES: "progress.report.read_advisees",
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
const ROLE_ONLY_PERMISSIONS = new Set<Permission>([
  PERMISSIONS.PROJECT_CREATE_ON_BEHALF,
  PERMISSIONS.PROJECT_ARCHIVE_ANY,
  PERMISSIONS.PROJECT_DELETE_ANY,
  PERMISSIONS.PROJECT_RESTORE,
  PERMISSIONS.ADMIN_USER_MANAGE,
  PERMISSIONS.ADMIN_TAG_MANAGE,
  PERMISSIONS.ADMIN_AUDIT_VIEW,
  PERMISSIONS.ADMIN_SETTINGS,
  PERMISSIONS.ADMIN_DASHBOARD,
]);

export const PERMISSION_LABELS: Record<Permission, string> = {
  [PERMISSIONS.ANNOUNCEMENT_READ]: "查看公告",
  [PERMISSIONS.POST_READ]: "查看帖子",
  [PERMISSIONS.PROJECT_READ]: "查看项目",
  [PERMISSIONS.COMMENT_READ]: "查看评论",
  [PERMISSIONS.ANNOUNCEMENT_CREATE]: "发布公告",
  [PERMISSIONS.ANNOUNCEMENT_UPDATE]: "编辑公告",
  [PERMISSIONS.ANNOUNCEMENT_DELETE]: "删除公告",
  [PERMISSIONS.ANNOUNCEMENT_NOTIFY_TARGETED]: "定向通知",
  [PERMISSIONS.POST_CREATE]: "发布帖子",
  [PERMISSIONS.POST_UPDATE_OWN]: "编辑自己的帖子",
  [PERMISSIONS.POST_DELETE_OWN]: "删除自己的帖子",
  [PERMISSIONS.POST_DELETE_ANY]: "删除任意帖子",
  [PERMISSIONS.COMMENT_CREATE]: "发表评论",
  [PERMISSIONS.COMMENT_DELETE_OWN]: "删除自己的评论",
  [PERMISSIONS.COMMENT_DELETE_ANY]: "删除任意评论",
  [PERMISSIONS.PROJECT_CREATE]: "创建项目",
  [PERMISSIONS.PROJECT_CREATE_ON_BEHALF]: "代导师创建项目",
  [PERMISSIONS.PROJECT_MANAGE]: "管理项目",
  [PERMISSIONS.PROJECT_ARCHIVE_ANY]: "归档任意项目",
  [PERMISSIONS.PROJECT_UPDATE_ADVISED]: "编辑负责项目",
  [PERMISSIONS.PROJECT_DELETE_ADVISED]: "软删除负责项目",
  [PERMISSIONS.PROJECT_DELETE_ANY]: "永久删除任意项目",
  [PERMISSIONS.PROJECT_RESTORE]: "恢复软删除项目",
  [PERMISSIONS.PROJECT_MEMBER_MANAGE]: "管理项目成员",
  [PERMISSIONS.PROJECT_NODE_CREATE]: "创建项目节点",
  [PERMISSIONS.PROGRESS_REPORT_WRITE]: "填写进度报告",
  [PERMISSIONS.PROGRESS_REPORT_SUBMIT]: "提交进度报告",
  [PERMISSIONS.PROGRESS_REPORT_READ_ALL]: "查看全部进度",
  [PERMISSIONS.PROGRESS_REPORT_READ_ADVISEES]: "查看直属学生进度",
  [PERMISSIONS.PROGRESS_EXPORT]: "导出进度",
  [PERMISSIONS.PROGRESS_BACKFILL]: "开启进度补填",
  [PERMISSIONS.TAG_REQUEST]: "申请 Tag",
  [PERMISSIONS.TAG_APPROVE]: "审批 Tag",
  [PERMISSIONS.TAG_REVOKE]: "撤销 Tag",
  [PERMISSIONS.ADMIN_USER_MANAGE]: "管理用户",
  [PERMISSIONS.ADMIN_TAG_MANAGE]: "管理 Tag",
  [PERMISSIONS.ADMIN_AUDIT_VIEW]: "查看审计",
  [PERMISSIONS.ADMIN_SETTINGS]: "管理设置",
  [PERMISSIONS.ADMIN_DASHBOARD]: "访问管理台",
};

export function describePermission(permission: Permission) {
  return PERMISSION_LABELS[permission];
}

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
    PERMISSIONS.PROJECT_CREATE_ON_BEHALF,
    PERMISSIONS.PROJECT_ARCHIVE_ANY,
    PERMISSIONS.PROJECT_DELETE_ANY,
    PERMISSIONS.PROJECT_RESTORE,
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

  // ADMIN is a governance-only role. Historical or malformed Tag assignments
  // must never turn an administrator into a content author.
  if (user.role === "ADMIN") return permissions;

  for (const userTag of user.tags) {
    if (userTag.projectId) continue;
    if (!isEffectiveTag(userTag, now)) continue;
    for (const permission of resolveTagPermissions(userTag)) {
      if (!ROLE_ONLY_PERMISSIONS.has(permission)) permissions.add(permission);
    }
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
  // Project capabilities are Tag-backed MEMBER capabilities, never ADMIN capabilities.
  if (user.role === "ADMIN") return permissions;

  for (const userTag of user.tags) {
    if (userTag.projectId !== projectId) continue;
    if (!isEffectiveTag(userTag, now)) continue;
    // Project.leaderId is the sole source of lead authority. The legacy
    // project-lead Tag remains display/backfill compatibility only.
    if (userTag.tag.name === `project-lead:${projectId}`) continue;
    for (const permission of resolveTagPermissions(userTag)) {
      if (!ROLE_ONLY_PERMISSIONS.has(permission)) permissions.add(permission);
    }
  }

  return permissions;
}

type PermissionQueryClient = Pick<Prisma.TransactionClient, "$queryRaw" | "user">;

async function getPermissionDatabaseNow(client: PermissionQueryClient) {
  const [{ now }] = await client.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`;
  return now;
}

export async function getUserPermissionsForClient(
  client: PermissionQueryClient,
  userId: string,
  now?: Date,
) {
  const effectiveNow = now ?? await getPermissionDatabaseNow(client);
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      status: true,
      tags: {
        where: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: effectiveNow } }],
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

  return computePermissionsFromSnapshot(user, effectiveNow);
}

export async function getUserPermissions(userId: string) {
  return getUserPermissionsForClient(prisma, userId);
}

export async function getEffectiveTagNames(userId: string) {
  const tags = await getEffectiveTags(userId);
  return tags.map((tag) => tag.name);
}

export async function getEffectiveTags(userId: string): Promise<EffectiveTag[]> {
  const now = await getPermissionDatabaseNow(prisma);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      tags: {
        where: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
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

export async function getProjectPermissionsForClient(
  client: PermissionQueryClient,
  userId: string,
  projectId: string,
  now?: Date,
) {
  const effectiveNow = now ?? await getPermissionDatabaseNow(client);
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      status: true,
      tags: {
        where: {
          projectId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: effectiveNow } }],
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

  return computeProjectPermissionsFromSnapshot(user, projectId, effectiveNow);
}

export async function getProjectPermissions(userId: string, projectId: string) {
  return getProjectPermissionsForClient(prisma, userId, projectId);
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
