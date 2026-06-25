import type { Prisma } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";
import type { ActiveSessionUser } from "@/shared/lib/session";

export const ANNOUNCEMENT_DEFAULT_TTL_HOURS = 72;

export type AnnouncementVisibilityViewer = {
  id: string;
  role: "ADMIN" | "MEMBER";
  tagIds: readonly string[];
  projectIds: readonly string[];
};

export type AnnouncementVisibilitySnapshot = {
  authorId?: string | null;
  deletedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  targetType: "ALL" | "PROJECT" | "TAG" | "USERS";
  targetIds: readonly string[];
};

export function getDefaultAnnouncementExpiresAt(now = new Date()) {
  return new Date(now.getTime() + ANNOUNCEMENT_DEFAULT_TTL_HOURS * 60 * 60 * 1000);
}

export function isAnnouncementActive(
  announcement: Pick<AnnouncementVisibilitySnapshot, "deletedAt" | "expiresAt">,
  now = new Date(),
) {
  if (announcement.deletedAt) return false;
  return !announcement.expiresAt || new Date(announcement.expiresAt).getTime() > now.getTime();
}

function intersects(left: readonly string[], right: readonly string[]) {
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

export function canViewAnnouncementFromSnapshot(
  viewer: AnnouncementVisibilityViewer,
  announcement: AnnouncementVisibilitySnapshot,
  now = new Date(),
) {
  if (!isAnnouncementActive(announcement, now)) return false;
  if (announcement.authorId === viewer.id) return true;
  if (viewer.role === "ADMIN") return true;
  if (announcement.targetType === "ALL") return true;
  if (announcement.targetType === "USERS") return announcement.targetIds.includes(viewer.id);
  if (announcement.targetType === "TAG") return intersects(announcement.targetIds, viewer.tagIds);
  return intersects(announcement.targetIds, viewer.projectIds);
}

export function buildAnnouncementVisibilityWhere(
  viewer: AnnouncementVisibilityViewer,
  now = new Date(),
): Prisma.AnnouncementWhereInput {
  const activeWhere: Prisma.AnnouncementWhereInput = {
    deletedAt: null,
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };

  if (viewer.role === "ADMIN") return activeWhere;

  return {
    AND: [
      activeWhere,
      {
        OR: [
          { authorId: viewer.id },
          { targetType: "ALL" },
          { targetType: "USERS", targetIds: { has: viewer.id } },
          ...(viewer.tagIds.length > 0 ? [{ targetType: "TAG" as const, targetIds: { hasSome: [...viewer.tagIds] } }] : []),
          ...(viewer.projectIds.length > 0
            ? [{ targetType: "PROJECT" as const, targetIds: { hasSome: [...viewer.projectIds] } }]
            : []),
        ],
      },
    ],
  };
}

export async function getAnnouncementVisibilityViewer(user: ActiveSessionUser, now = new Date()) {
  if (user.role === "ADMIN") {
    return { id: user.id, role: user.role, tagIds: [], projectIds: [] } satisfies AnnouncementVisibilityViewer;
  }

  const [tagGrants, memberships, advisedProjects] = await Promise.all([
    prisma.userTag.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { tagId: true, projectId: true },
    }),
    prisma.projectMember.findMany({
      where: { userId: user.id, project: { deletedAt: null } },
      select: { projectId: true },
    }),
    prisma.project.findMany({
      where: { advisorId: user.id, deletedAt: null },
      select: { id: true },
    }),
  ]);

  return {
    id: user.id,
    role: user.role,
    tagIds: [...new Set(tagGrants.map((grant) => grant.tagId))],
    projectIds: [
      ...new Set([
        ...tagGrants.flatMap((grant) => (grant.projectId ? [grant.projectId] : [])),
        ...memberships.map((membership) => membership.projectId),
        ...advisedProjects.map((project) => project.id),
      ]),
    ],
  } satisfies AnnouncementVisibilityViewer;
}
