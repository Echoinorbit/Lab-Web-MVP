import { notFound, redirect } from "next/navigation";

import { ProjectDetail } from "@/features/projects";
import type { TimelineNode } from "@/features/projects";
import type { ProjectCanvasSourceNode } from "@/features/projects/lib/node-canvas";
import { canViewProject } from "@/features/projects/lib/visibility";
import { hasEffectiveProjectLeadTag } from "@/features/projects/lib/tag-grants";
import { FORBIDDEN_ROUTE } from "@/shared/lib/access-denied";
import { getEffectiveTags, getProjectPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

type ProjectNodeWithAuthor = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  nodeType: TimelineNode["nodeType"];
  parentId: string | null;
  authorId: string;
  colorHex: string | null;
  createdAt: Date;
  author: { displayName: string };
};

function buildNodeTree(nodes: readonly ProjectNodeWithAuthor[]): TimelineNode[] {
  const roots: TimelineNode[] = [];
  const byId = new Map<string, TimelineNode>();

  for (const node of nodes) {
    byId.set(node.id, {
      id: node.id,
      projectId: node.projectId,
      title: node.title,
      description: node.description ?? undefined,
      nodeType: node.nodeType,
      authorId: node.authorId,
      authorName: node.author.displayName,
      colorHex: node.colorHex,
      createdAt: formatDate(node.createdAt),
      children: [],
    });
  }

  for (const node of nodes) {
    const row = byId.get(node.id);
      if (!row) continue;
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)?.children?.push(row);
    } else {
      roots.push(row);
    }
  }

  return roots;
}

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
    createdAt: formatDate(node.createdAt),
    colorHex: node.colorHex,
  }));
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireActiveUser();
  const [project, effectiveTags] = await Promise.all([
    prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, displayName: true } } },
          orderBy: { joinedAt: "asc" },
        },
        nodes: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          include: { author: { select: { displayName: true } } },
        },
      },
    }),
    getEffectiveTags(user.id),
  ]);
  if (!project) notFound();
  if (!canViewProject({ id: user.id, role: user.role, tags: effectiveTags }, project)) {
    redirect(FORBIDDEN_ROUTE);
  }

  const projectPermissions = await getProjectPermissions(user.id, id);
  const isProjectLead = hasEffectiveProjectLeadTag(effectiveTags, id);
  const isArchived = project.status === "ARCHIVED";
  const memberIds = new Set(project.members.map((member) => member.userId));
  const availableUsers = projectPermissions.has(PERMISSIONS.PROJECT_MEMBER_MANAGE) && !isArchived
    ? await prisma.user.findMany({
        where: {
          role: "MEMBER",
          status: "ACTIVE",
          id: { notIn: [...memberIds] },
        },
        orderBy: [{ displayName: "asc" }],
        select: { id: true, username: true, displayName: true },
      })
    : [];

  return (
    <ProjectDetail
      id={project.id}
      name={project.name}
      status={project.status}
      description={project.description ?? undefined}
      archivedAt={project.archivedAt?.toISOString() ?? null}
      viewerId={user.id}
      nodes={buildNodeTree(project.nodes)}
      canvasNodes={buildCanvasNodes(project.nodes)}
      members={project.members.map((member) => ({
        id: member.user.id,
        username: member.user.username,
        displayName: member.user.displayName,
      }))}
      availableUsers={availableUsers}
      parentOptions={project.nodes.map((node) => ({ id: node.id, title: node.title }))}
      canManageMembers={projectPermissions.has(PERMISSIONS.PROJECT_MEMBER_MANAGE)}
      canCreateNode={projectPermissions.has(PERMISSIONS.PROJECT_NODE_CREATE)}
      canArchive={isProjectLead}
    />
  );
}
