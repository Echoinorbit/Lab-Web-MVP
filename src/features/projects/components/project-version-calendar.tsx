"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";

import { cn } from "@/shared/lib/utils";

import { projectStatusLabels, type ProjectSummary } from "../data";
import { buildProjectTimeline, getTimelinePosition, type TimelineGranularity } from "../lib/project-timeline";

const statusColors = {
  PLANNING: "#b8b8b8",
  IN_PROGRESS: "#fffa00",
  REVIEW: "#67b7ff",
  COMPLETED: "#71ba81",
  ARCHIVED: "#7c7c7c",
} as const;

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function formatTick(value: Date, granularity: TimelineGranularity) {
  return new Intl.DateTimeFormat("zh-CN", granularity === "month"
    ? { year: "numeric", month: "short" }
    : { month: "numeric", day: "numeric" }).format(value);
}

export function ProjectVersionCalendar({ projects, asOf }: { projects: readonly ProjectSummary[]; asOf: string }) {
  const router = useRouter();
  const [granularity, setGranularity] = useState<TimelineGranularity>("month");
  const now = useMemo(() => new Date(asOf), [asOf]);
  const timeline = useMemo(() => buildProjectTimeline(projects, granularity, now), [granularity, now, projects]);
  const tickWidth = granularity === "month" ? 10 : 5;
  const gridStyle = { gridTemplateColumns: `18rem repeat(${timeline.ticks.length}, ${tickWidth}rem)` };
  const todayPosition = getTimelinePosition(now, timeline);

  return (
    <section aria-label="项目版本日历" className="border border-foreground bg-card">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-foreground bg-foreground px-6 py-5 text-background portrait:px-5">
        <div>
          <div className="flex items-center gap-2 font-ui-medium text-[.8125rem] tracking-[.08em] text-background/65">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            版本日历
          </div>
          <h2 className="mt-2 font-ui-bold text-[1.75rem] leading-none">项目路线图</h2>
        </div>
        <div className="flex border border-background/35" aria-label="时间粒度">
          {(["month", "week"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={granularity === value}
              onClick={() => setGranularity(value)}
              className={cn(
                "min-h-10 px-4 font-ui-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fffa00] focus-visible:ring-inset",
                granularity === value ? "bg-[#fffa00] text-foreground" : "text-background hoverable:hover:bg-background/15",
              )}
            >
              按{value === "month" ? "月" : "周"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-max">
          <div className="grid border-b border-border bg-surface text-[.75rem] text-muted-foreground" style={gridStyle}>
            <div className="sticky left-0 z-10 border-r border-border bg-surface px-5 py-3 font-ui-medium">项目 / 时间</div>
            {timeline.ticks.map((tick) => <time key={tick.toISOString()} className="border-l border-border px-2 py-3 text-center">{formatTick(tick, granularity)}</time>)}
          </div>

          {projects.map((project) => {
            const color = project.deletedAt ? "#ef4444" : statusColors[project.status];
            const start = getTimelinePosition(project.createdAt, timeline);
            const end = getTimelinePosition(project.archivedAt ?? now, timeline);
            const width = Math.max(1.25, end - start);
            const ariaLabel = `${project.name} · ${project.deletedAt ? "已软删除" : projectStatusLabels[project.status]} · ${formatDate(project.createdAt)} 至 ${formatDate(project.archivedAt ?? now)} · ${project.milestones.length} 个节点`;

            return (
              <div key={project.id} role="group" className="grid min-h-24 border-b border-border last:border-b-0" style={gridStyle} aria-label={ariaLabel}>
                <Link
                  href={`/projects/${project.id}`}
                  className="sticky left-0 z-10 flex min-w-0 flex-col justify-center border-r border-border bg-card px-5 py-4 text-left transition-colors hoverable:hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="truncate font-ui-medium text-[1rem] text-foreground">{project.name}</span>
                  <span className="mt-1 text-[.8125rem] text-muted-foreground">{project.deletedAt ? "已软删除" : projectStatusLabels[project.status]} · {project.nodeCount} 个节点</span>
                </Link>
                <div className="relative" style={{ gridColumn: "2 / -1" }}>
                  <span className="absolute inset-y-0 w-px bg-[#fffa00]" style={{ left: `${todayPosition}%` }} aria-label="今天" />
                  <span
                    className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-[var(--timeline-color)]"
                    style={{ left: `${start}%`, width: `${width}%`, "--timeline-color": color } as CSSProperties}
                    aria-hidden="true"
                  />
                  {project.milestones.map((milestone) => (
                    <button
                      key={milestone.id}
                      type="button"
                      title={milestone.title}
                      aria-label={`${project.name}：${milestone.title}，${formatDate(milestone.createdAt)}`}
                      onClick={() => router.push(`/projects/${project.id}#project-node-${milestone.id}`)}
                      className="absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-[var(--timeline-color)] transition-transform hoverable:hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      style={{ left: `${getTimelinePosition(milestone.createdAt, timeline)}%`, "--timeline-color": milestone.colorHex ?? color } as CSSProperties}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="border-t border-border px-6 py-3 text-[.8125rem] text-muted-foreground portrait:px-5">黄色竖线表示今天；节点点位可打开对应项目节点。</p>
    </section>
  );
}
