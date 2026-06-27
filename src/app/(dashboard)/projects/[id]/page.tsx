import { notFound, redirect } from "next/navigation";

import { ProjectDetail } from "@/features/projects";
import type { ProjectCanvasSourceNode } from "@/features/projects/lib/node-canvas";
import { canViewProject } from "@/features/projects/lib/visibility";
import { hasEffectiveProjectLeadTag } from "@/features/projects/lib/tag-grants";
import {
  canEditProjectSnapshot,
  canHardDeleteProjectSnapshot,
  canRestoreProjectSnapshot,
  canSoftDeleteProjectSnapshot,
} from "@/features/projects/lib/project-governance";
import { FORBIDDEN_ROUTE } from "@/shared/lib/access-denied";
import { getEffectiveTags, getProjectPermissions, getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

type ProjectNodeWithAuthor = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  nodeType: ProjectCanvasSourceNode["nodeType"];
  parentId: string | null;
  authorId: string;
  colorHex: string | null;
  createdAt: Date;
  author: { displayName: string };
};

function buildCanvasNodes(nodes: readonly ProjectNodeWithAuthor[]): ProjectCanvasSourceNode[] {
  return nodes.map((node) => ({
    id: node.id,
    projectId: node.projectId,
    title: node.title,
    description: node.description ?? undefined,
    nodeType: node.nodeType,
    parentId: node.parentId,
    authorId: node.authorId,
    authorName: node.author.displayName,
    createdAt: node.createdAt.toISOString(),
    colorHex: node.colorHex,
  }));
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireActiveUser();
  const [project, effectiveTags] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, displayName: true } } },
          orderBy: { joinedAt: "asc" },
        },
        nodes: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: { author: { select: { displayName: true } } },
        },
        advisor: {
          select: {
            id: true,
            username: true,
            displayName: true,
            students: {
              where: { role: "MEMBER", status: "ACTIVE" },
              orderBy: [{ grade: "asc" }, { displayName: "asc" }],
              select: { id: true, username: true, displayName: true, grade: true, studentId: true },
            },
          },
        },
      },
    }),
    getEffectiveTags(user.id),
  ]);
  if (!project) notFound();
  if (project.deletedAt && user.role !== "ADMIN") notFound();
  if (!canViewProject({ id: user.id, role: user.role, tags: effectiveTags }, project)) {
    redirect(FORBIDDEN_ROUTE);
  }

  const [projectPermissions, globalPermissions] = await Promise.all([
    getProjectPermissions(user.id, id),
    getUserPermissions(user.id),
  ]);
  const combinedPermissions = new Set([...projectPermissions, ...globalPermissions]);
  const isProjectLead = hasEffectiveProjectLeadTag(effectiveTags, id);
  const isArchived = project.status === "ARCHIVED";
  const isDeleted = Boolean(project.deletedAt);
  const memberIds = new Set(project.members.map((member) => member.userId));
  const availableAdvisor = projectPermissions.has(PERMISSIONS.PROJECT_MEMBER_MANAGE) && !isArchived && !isDeleted && project.advisor
    ? { ...project.advisor, students: project.advisor.students.filter((student) => !memberIds.has(student.id)) }
    : undefined;

  return (
    <ProjectDetail
      id={project.id}
      name={project.name}
      status={project.status}
      description={project.description ?? undefined}
      archivedAt={project.archivedAt?.toISOString() ?? null}
      deletedAt={project.deletedAt?.toISOString() ?? null}
      viewerId={user.id}
      canvasNodes={buildCanvasNodes(project.nodes)}
      members={project.members.map((member) => ({
        id: member.user.id,
        username: member.user.username,
        displayName: member.user.displayName,
      }))}
      availableAdvisor={availableAdvisor}
      parentOptions={project.nodes.map((node) => ({ id: node.id, title: node.title }))}
      canManageMembers={projectPermissions.has(PERMISSIONS.PROJECT_MEMBER_MANAGE) && !isDeleted}
      canCreateNode={projectPermissions.has(PERMISSIONS.PROJECT_NODE_CREATE) && !isDeleted}
      canArchive={isProjectLead && projectPermissions.has(PERMISSIONS.PROJECT_MANAGE) && !isDeleted}
      canEdit={canEditProjectSnapshot(user.id, project, { globalPermissions, projectPermissions })}
      canSoftDelete={canSoftDeleteProjectSnapshot(user.id, project, combinedPermissions)}
      canRestore={canRestoreProjectSnapshot(project, combinedPermissions)}
      canHardDelete={canHardDeleteProjectSnapshot(combinedPermissions)}
    />
  );
}
