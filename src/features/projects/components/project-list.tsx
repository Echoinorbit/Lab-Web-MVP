import { FolderKanban } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import { EmptyState } from "@/shared/components/ui/empty-state";

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

const statusLabels: Record<string, string> = {
  PLANNING: "规划中",
  IN_PROGRESS: "进行中",
  REVIEW: "评审中",
  COMPLETED: "已完成",
  ARCHIVED: "已归档",
};

export function ProjectList({ projects }: { projects: readonly ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<FolderKanban className="h-5 w-5" aria-hidden="true" />}
        title="暂无可见项目"
        description="创建或加入项目后，项目脉络与最新节点会显示在这里。"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="group relative flex min-h-56 flex-col rounded-2xl border border-border/90 bg-card p-5 transition-[border-color,background-color] duration-[var(--motion-fast)] hover:border-foreground/25 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold leading-6 tracking-[-0.024em] transition-colors group-hover:text-primary">{project.name}</h3>
            <Badge className={project.deletedAt ? "border-destructive/30 bg-destructive/10 text-destructive" : undefined}>
              {project.deletedAt ? "已软删除" : statusLabels[project.status] ?? project.status}
            </Badge>
          </div>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{summarizeProjectDescription(project.description)}</p>
          <dl className="mt-auto grid grid-cols-2 gap-4 border-t border-border/75 pt-5 text-sm tabular-nums">
            <div>
              <dt className="text-xs text-muted-foreground">成员</dt>
              <dd className="mt-1 text-xl font-semibold tracking-[-0.025em]">{project.memberCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">节点</dt>
              <dd className="mt-1 text-xl font-semibold tracking-[-0.025em]">{project.nodeCount}</dd>
            </div>
          </dl>
          {project.canPreview ? (
            <div
              data-project-preview
              className="ui-popover-enter absolute left-3 top-[calc(100%+8px)] z-40 hidden w-72 origin-top-left rounded-2xl border border-border bg-surface-raised p-4 text-sm shadow-[var(--shadow-popover)] group-hover:block group-focus-within:block"
            >
              <div className="font-semibold">{project.name}</div>
              <p className="mt-2 leading-6 text-muted-foreground">{summarizeProjectDescription(project.description)}</p>
              <div className="mt-3 text-xs text-muted-foreground">{project.memberCount} 位成员 · {project.nodeCount} 个节点</div>
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
