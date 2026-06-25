import Link from "next/link";

import { ProjectList } from "@/features/projects";
import { getMyProjectWhere, getProjectVisibilityWhere, hasGlobalAdvisorTag, parseProjectListTab } from "@/features/projects/lib/visibility";
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
  const tab = parseProjectListTab((await searchParams).tab);
  const user = await requireActiveUser();
  const [permissions, effectiveTags] = await Promise.all([getUserPermissions(user.id), getEffectiveTags(user.id)]);
  const viewer = { id: user.id, role: user.role, tags: effectiveTags };
  const canPreviewProjects = hasGlobalAdvisorTag(viewer);
  const projectWhere = tab === "mine" ? getMyProjectWhere(viewer) : getProjectVisibilityWhere(viewer);
  const projects = await prisma.project.findMany({
    where: projectWhere,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: {
          members: true,
          nodes: { where: { deletedAt: null } },
        },
      },
    },
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <div className="space-y-3">
        <div className="flex gap-2">
          {(
            [
              ["all", "全部项目"],
              ["mine", "我负责的项目"],
            ] as const
          ).map(([value, label]) => (
            <Link
              key={value}
              href={`/projects?tab=${value}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted",
                tab === value && "bg-primary text-primary-foreground hover:bg-primary/90",
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
            canPreview: canPreviewProjects,
          }))}
        />
      </div>
      {permissions.has(PERMISSIONS.PROJECT_CREATE) ? (
        <Card>
          <CardHeader>
            <CardTitle>项目创建</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/projects/new"
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              创建项目
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
