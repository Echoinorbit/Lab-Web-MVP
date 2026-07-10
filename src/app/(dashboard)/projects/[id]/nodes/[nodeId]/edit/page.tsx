import { notFound, redirect } from "next/navigation";

import { ProjectNodeEditForm } from "@/features/projects/components/project-node-edit-form";
import { canViewProject } from "@/features/projects/lib/visibility";
import { FORBIDDEN_ROUTE } from "@/shared/lib/access-denied";
import { getEffectiveTags } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

export default async function ProjectNodeEditPage({
  params,
}: {
  params: Promise<{ id: string; nodeId: string }>;
}) {
  const { id, nodeId } = await params;
  const user = await requireActiveUser();
  const [node, effectiveTags] = await Promise.all([
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
        authorId: true,
        project: {
          select: {
            advisorId: true,
            members: { select: { userId: true } },
          },
        },
      },
    }),
    getEffectiveTags(user.id),
  ]);

  if (!node) notFound();
  if (!canViewProject({ id: user.id, role: user.role, tags: effectiveTags }, node.project)) {
    redirect(FORBIDDEN_ROUTE);
  }
  if (node.authorId !== user.id) {
    redirect(FORBIDDEN_ROUTE);
  }

  return (
    <div className="mx-auto max-w-3xl py-2">
      <ProjectNodeEditForm node={node} />
    </div>
  );
}
