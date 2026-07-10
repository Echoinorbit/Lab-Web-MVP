import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

import { summarizeProjectDescription } from "../lib/preview";

export type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  memberCount: number;
  nodeCount: number;
  description?: string | null;
  canPreview?: boolean;
  deletedAt?: string | null;
};

export function ProjectList({ projects }: { projects: readonly ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-border bg-card px-6 py-12 text-center">
        <div className="text-[15px] font-medium">暂无可见项目</div>
        <p className="mt-1 text-sm text-muted-foreground">加入项目后，最近动态会显示在这里。</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <Link key={project.id} href={`/projects/${project.id}`} className="group relative block">
          <Card className="h-full transition-[border-color,background-color] duration-200 ease-out hover:border-foreground/20 hover:bg-muted/25">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-[15px]">{project.name}</CardTitle>
                <Badge>{project.deletedAt ? "已软删除" : project.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 pt-5 text-sm tabular-nums">
              <div>
                <div className="text-xs text-muted-foreground">成员</div>
                <div className="mt-1 text-lg font-semibold tracking-[-0.02em]">{project.memberCount}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">节点</div>
                <div className="mt-1 text-lg font-semibold tracking-[-0.02em]">{project.nodeCount}</div>
              </div>
            </CardContent>
          </Card>
          {project.canPreview ? (
            <div data-project-preview className="absolute left-0 top-full z-40 mt-2 hidden w-72 rounded-[14px] border border-border bg-card p-4 text-sm shadow-[var(--shadow-card)] group-hover:block">
              <div className="font-medium">{project.name}</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">状态</div>
                  <div className="font-medium">{project.status}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">成员</div>
                  <div className="font-medium">{project.memberCount}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">节点</div>
                  <div className="font-medium">{project.nodeCount}</div>
                </div>
              </div>
              <p className="mt-3 leading-6 text-muted-foreground">{summarizeProjectDescription(project.description)}</p>
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
