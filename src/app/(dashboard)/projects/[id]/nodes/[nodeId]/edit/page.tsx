import { notFound, redirect } from "next/navigation";

import { ProjectNodeEditForm } from "@/features/projects/components/project-node-edit-form";
import { resolveProjectNodeManagerAccess } from "@/features/projects/lib/node-author-ops";
import { canManageProjectNodesSnapshot } from "@/features/projects/lib/project-governance";
import { isCanonicalProjectLeaderEligible } from "@/features/projects/lib/project-responsibility";
import { canViewProject } from "@/features/projects/lib/visibility";
import { FORBIDDEN_ROUTE } from "@/shared/lib/access-denied";
import { PageHeader } from "@/shared/components/ui/page-header";
import { getEffectiveTags, getProjectPermissions, getUserPermissions } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

export default async function ProjectNodeEditPage({
  params,
}: {
  params: Promise<{ id: string; nodeId: string }>;
}) {
  const { id, nodeId } = await params;
  const user = await requireActiveUser();
  const [node, effectiveTags, projectPermissions, globalPermissions] = await Promise.all([
    prisma.projectNode.findFirst({
      where: {
        id: nodeId,
        projectId: id,
        deletedAt: null,
        project: { deletedAt: null },
      },
      select: {
        id: true,
        title: true,
        description: true,
        nodeType: true,
        parentId: true,
        authorId: true,
        project: {
          select: {
            advisorId: true,
            leaderId: true,
            leader: {
              select: {
                role: true,
                status: true,
                studyDegree: true,
                identityNeedsReview: true,
                advisorId: true,
              },
            },
            nodes: {
              where: { deletedAt: null },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: { id: true, title: true },
            },
            members: { select: { userId: true } },
          },
        },
      },
    }),
    getEffectiveTags(user.id),
    getProjectPermissions(user.id, id),
    getUserPermissions(user.id),
  ]);

  if (!node) notFound();
  if (!canViewProject({ id: user.id, role: user.role, tags: effectiveTags }, node.project)) {
    redirect(FORBIDDEN_ROUTE);
  }
  const isProjectLead = node.project.leaderId === user.id
    && isCanonicalProjectLeaderEligible(node.project.leader, node.project.advisorId);
  const access = resolveProjectNodeManagerAccess({
    userId: user.id,
    authorId: node.authorId,
    canManageProjectNodes: canManageProjectNodesSnapshot(user.id, isProjectLead, node.project, {
      projectPermissions,
      globalPermissions,
    }),
  });
  if (!access.allowed) {
    redirect(FORBIDDEN_ROUTE);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="编辑项目节点" description="节点作者、项目负责人和负责导师可以修改内容、类型与父节点关系。" />
      <ProjectNodeEditForm node={node} parentOptions={node.project.nodes.filter((candidate) => candidate.id !== node.id)} />
    </div>
  );
}
