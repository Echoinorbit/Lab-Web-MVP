"use client";

import { GitBranch, ListTree } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/components/ui/button";

import { CommitGraphView } from "./commit-graph-view";
import { ProjectTimeline } from "./timeline";
import type { TimelineNode } from "./node-card";
import { buildAuthorLegend } from "../lib/author-color";
import type { ProjectCanvasSourceNode } from "../lib/node-canvas";

type ProjectNodeView = "graph" | "list";

export function ProjectNodeViews({
  viewerId,
  timelineNodes,
  canvasNodes,
  canManageNodeActions,
}: {
  viewerId: string;
  timelineNodes: readonly TimelineNode[];
  canvasNodes: readonly ProjectCanvasSourceNode[];
  canManageNodeActions: boolean;
}) {
  const [view, setView] = useState<ProjectNodeView>("graph");
  const legend = buildAuthorLegend(canvasNodes);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">项目节点</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={view === "graph" ? "primary" : "secondary"}
            aria-pressed={view === "graph"}
            onClick={() => setView("graph")}
          >
            <GitBranch className="h-4 w-4" />
            提交图
          </Button>
          <Button
            type="button"
            variant={view === "list" ? "primary" : "secondary"}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <ListTree className="h-4 w-4" />
            列表
          </Button>
        </div>
      </div>
      {view === "list" && legend.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {legend.map((author) => (
            <span
              key={author.authorId}
              data-project-author-legend
              className="inline-flex h-7 items-center gap-2 rounded-md border bg-card px-2"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: author.color }}
                aria-hidden="true"
              />
              {author.authorName}
            </span>
          ))}
        </div>
      ) : null}
      {view === "graph" ? (
        <CommitGraphView viewerId={viewerId} nodes={canvasNodes} canManageNodeActions={canManageNodeActions} />
      ) : (
        <ProjectTimeline viewerId={viewerId} nodes={timelineNodes} canManageNodeActions={canManageNodeActions} />
      )}
    </div>
  );
}
