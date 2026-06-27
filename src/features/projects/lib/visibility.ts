import type { Prisma } from "@prisma/client";

import type { EffectiveTag, RoleName } from "@/shared/lib/permissions";
import { ADVISOR_TAG_NAME } from "@/shared/lib/system-tags";

export type ProjectVisibilityViewer = {
  id: string;
  role: RoleName;
  tags: readonly EffectiveTag[];
};

export type ProjectVisibilitySnapshot = {
  advisorId?: string | null;
  members?: readonly { userId: string }[];
};

export type ProjectListTab = "all" | "mine" | "deleted";

export function parseProjectListTab(value: string | string[] | undefined): ProjectListTab {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "mine" || rawValue === "deleted" ? rawValue : "all";
}

export function hasGlobalAdvisorTag(viewer: Pick<ProjectVisibilityViewer, "tags">) {
  return viewer.tags.some((tag) => tag.name === ADVISOR_TAG_NAME && tag.projectId === null);
}

function advisorProjectParticipationWhere(viewerId: string): Prisma.ProjectWhereInput[] {
  return [{ advisorId: viewerId }, { members: { some: { userId: viewerId } } }];
}

export function getProjectVisibilityWhere(viewer: ProjectVisibilityViewer): Prisma.ProjectWhereInput {
  const baseWhere = { deletedAt: null };
  if (viewer.role === "ADMIN") return baseWhere;
  if (hasGlobalAdvisorTag(viewer)) return { ...baseWhere, OR: advisorProjectParticipationWhere(viewer.id) };
  return { ...baseWhere, members: { some: { userId: viewer.id } } };
}

export function getMyProjectWhere(viewer: ProjectVisibilityViewer): Prisma.ProjectWhereInput {
  const baseWhere = { deletedAt: null };
  if (viewer.role === "ADMIN") {
    return {
      ...baseWhere,
      OR: [{ creatorId: viewer.id }, { advisorId: viewer.id }, { members: { some: { userId: viewer.id } } }],
    };
  }
  if (hasGlobalAdvisorTag(viewer)) return { ...baseWhere, OR: advisorProjectParticipationWhere(viewer.id) };
  return { ...baseWhere, members: { some: { userId: viewer.id } } };
}

export function canViewProject(viewer: ProjectVisibilityViewer, project: ProjectVisibilitySnapshot) {
  if (viewer.role === "ADMIN") return true;
  if (hasGlobalAdvisorTag(viewer) && project.advisorId === viewer.id) return true;
  return (project.members ?? []).some((member) => member.userId === viewer.id);
}
