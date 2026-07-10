import Link from "next/link";

import { ProjectList } from "@/features/projects";
import { canViewProject, getMyProjectWhere, getProjectVisibilityWhere, parseProjectListTab } from "@/features/projects/lib/visibility";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "可见项目"],
              ["mine", "我参与/负责"],
              ...(user.role === "ADMIN" ? [["deleted", "已软删除"]] as const : []),
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={`/projects?tab=${value}`}
              className={cn(
                "inline-flex h-10 items-center rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:bg-muted",
                tab === value && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
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
      {permissions.has(PERMISSIONS.PROJECT_CREATE) || permissions.has(PERMISSIONS.PROJECT_CREATE_ON_BEHALF) ? (
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>项目创建</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/projects/new"
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              创建项目
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
