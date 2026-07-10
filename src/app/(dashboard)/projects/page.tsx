import { Plus } from "lucide-react";
import Link from "next/link";

import { ProjectList } from "@/features/projects";
import { canViewProject, getMyProjectWhere, getProjectVisibilityWhere, parseProjectListTab } from "@/features/projects/lib/visibility";
import { buttonStyles } from "@/shared/components/ui/button";
import { PageHeader } from "@/shared/components/ui/page-header";
import { getEffectiveTags, getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { cn } from "@/shared/lib/utils";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const requestedTab = parseProjectListTab((await searchParams).tab);
  const user = await requireActiveUser();
  const [permissions, effectiveTags] = await Promise.all([getUserPermissions(user.id), getEffectiveTags(user.id)]);
  const viewer = { id: user.id, role: user.role, tags: effectiveTags };
  const tab = requestedTab === "deleted" && user.role !== "ADMIN" ? "all" : requestedTab;
  const projectWhere = tab === "deleted"
    ? { deletedAt: { not: null } }
    : tab === "mine" ? getMyProjectWhere(viewer) : getProjectVisibilityWhere(viewer);
  const projects = await prisma.project.findMany({
    where: projectWhere,
    orderBy: { updatedAt: "desc" },
    include: {
      members: { select: { userId: true } },
      _count: {
        select: {
          members: true,
          nodes: { where: { deletedAt: null } },
        },
      },
    },
  });
  const canCreate = permissions.has(PERMISSIONS.PROJECT_CREATE) || permissions.has(PERMISSIONS.PROJECT_CREATE_ON_BEHALF);

  return (
    <div className="space-y-8">
      <PageHeader
        title="项目"
        description="以节点图追踪研究过程，并在明确的导师、组长与成员范围内协作。"
        actions={canCreate ? (
          <Link href="/projects/new" className={buttonStyles()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            创建项目
          </Link>
        ) : null}
      />

      <nav aria-label="项目筛选" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {(
          [
            ["all", "可见项目"],
            ["mine", "我参与或负责"],
            ...(user.role === "ADMIN" ? [["deleted", "已软删除"]] as const : []),
          ] as const
        ).map(([value, label]) => (
          <Link
            key={value}
            href={`/projects?tab=${value}`}
            aria-current={tab === value ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center rounded-[9px] px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === value && "bg-card text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <ProjectList
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          status: project.status,
          memberCount: project._count.members,
          nodeCount: project._count.nodes,
          description: project.description,
          canPreview: canViewProject(viewer, project),
          deletedAt: project.deletedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
