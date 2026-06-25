"use client";

import { CircleAlert, FileText, Flag, GitCommitHorizontal, Lightbulb, Paperclip } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

import { ProjectNodeActions } from "./project-node-actions";
import { buildCommitGraph, type CommitGraphRow } from "../lib/commit-graph";
import type { ProjectCanvasSourceNode } from "../lib/node-canvas";

const nodeMeta = {
  MILESTONE: { label: "里程碑", icon: Flag, className: "bg-primary text-primary-foreground" },
  UPDATE: { label: "更新", icon: GitCommitHorizontal, className: "bg-muted" },
  DECISION: { label: "决策", icon: Lightbulb, className: "bg-secondary" },
  ISSUE: { label: "问题", icon: CircleAlert, className: "bg-destructive text-destructive-foreground" },
  RESOURCE: { label: "资源", icon: Paperclip, className: "bg-muted" },
} as const;

const rowHeight = 58;
const laneGap = 26;
const graphPadding = 14;

function truncateText(value: string | undefined, maxLength: number) {
  if (!value) return "";
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}...` : compact;
}

function formatNodeDate(value: string) {
  return value.slice(5);
}

function CommitGraphRail({
  row,
  laneCount,
}: {
  row: CommitGraphRow;
  laneCount: number;
}) {
  const width = Math.max(72, graphPadding * 2 + laneCount * laneGap);
  const centerY = rowHeight / 2;
  const laneX = (laneIndex: number) => graphPadding + laneIndex * laneGap;
  const x = laneX(row.laneIndex);
  const linkedLanes = [...new Set([row.parentLaneIndex, ...row.childLaneIndexes].filter((lane): lane is number => lane !== null))];

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={rowHeight}
      viewBox={`0 0 ${width} ${rowHeight}`}
      className="block shrink-0"
    >
      {Array.from({ length: laneCount }).map((_, laneIndex) => (
        <line
          key={laneIndex}
          x1={laneX(laneIndex)}
          y1={0}
          x2={laneX(laneIndex)}
          y2={rowHeight}
          stroke={laneIndex === row.laneIndex ? row.color : "hsl(var(--border))"}
          strokeWidth={laneIndex === row.laneIndex ? 2 : 1}
          opacity={laneIndex === row.laneIndex ? 0.85 : 0.55}
        />
      ))}
      {linkedLanes.map((targetLane) => {
        if (targetLane === row.laneIndex) return null;
        const targetX = laneX(targetLane);
        const startX = Math.min(x, targetX);
        const endX = Math.max(x, targetX);
        return (
          <path
            key={targetLane}
            d={`M ${startX} ${centerY} C ${startX + 8} ${centerY}, ${endX - 8} ${centerY}, ${endX} ${centerY}`}
            fill="none"
            stroke={row.color}
            strokeWidth={2}
            opacity={0.9}
          />
        );
      })}
      <circle cx={x} cy={centerY} r={6} fill={row.color} stroke="hsl(var(--card))" strokeWidth={2} />
      <circle cx={x} cy={centerY} r={10} fill="none" stroke={row.color} strokeWidth={1.5} opacity={0.4} />
    </svg>
  );
}

function CommitGraphRowButton({
  row,
  laneCount,
  selected,
  onSelect,
}: {
  row: CommitGraphRow;
  laneCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = nodeMeta[row.nodeType];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      data-project-commit-row
      data-selected={selected ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "grid w-full grid-cols-[auto_minmax(0,1fr)_88px] items-stretch border-b text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "bg-primary/10" : "bg-card",
      )}
    >
      <div className={cn("border-r", selected ? "bg-primary/10" : "bg-muted/30")}>
        <CommitGraphRail row={row} laneCount={laneCount} />
      </div>
      <div className="min-w-0 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge className={meta.className}>
            <Icon className="mr-1 h-3 w-3" />
            {meta.label}
          </Badge>
          <span className="min-w-0 truncate text-sm font-medium">{row.title}</span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
            {row.authorName}
          </span>
          {row.description ? <span className="min-w-0 truncate">{truncateText(row.description, 72)}</span> : null}
        </div>
      </div>
      <div className="flex items-center justify-end px-3 text-xs text-muted-foreground">{formatNodeDate(row.createdAt)}</div>
    </button>
  );
}

function CommitInspector({
  row,
  viewerId,
  canManageNodeActions,
}: {
  row: CommitGraphRow;
  viewerId: string;
  canManageNodeActions: boolean;
}) {
  const meta = nodeMeta[row.nodeType];
  const Icon = meta.icon;
  const canManageNode = canManageNodeActions && row.authorId === viewerId;

  return (
    <aside className="flex min-h-[520px] flex-col border-l bg-muted/20" data-project-commit-inspector>
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <Badge className={meta.className}>
            <Icon className="mr-1 h-3 w-3" />
            {meta.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{row.createdAt}</span>
        </div>
        <h3 className="mt-3 text-base font-semibold leading-6">{row.title}</h3>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
          {row.authorName}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileText className="h-4 w-4" />
          节点说明
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
          {row.description || "暂无说明。"}
        </p>
      </div>
      <div className="border-t px-4 py-3">
        {canManageNode ? (
          <ProjectNodeActions projectId={row.projectId} nodeId={row.id} />
        ) : (
          <p className="text-xs text-muted-foreground">节点由作者维护；项目组长不能修改他人节点。</p>
        )}
      </div>
    </aside>
  );
}

export function CommitGraphView({
  nodes,
  viewerId,
  canManageNodeActions,
}: {
  nodes: readonly ProjectCanvasSourceNode[];
  viewerId: string;
  canManageNodeActions: boolean;
}) {
  const graph = useMemo(() => buildCommitGraph(nodes), [nodes]);
  const [selectedId, setSelectedId] = useState<string | null>(graph.rows[0]?.id ?? null);
  const selectedRow = graph.rows.find((row) => row.id === selectedId) ?? graph.rows[0] ?? null;

  if (graph.rows.length === 0) {
    return (
      <div className="rounded-md border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        暂无项目节点。
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border bg-card" data-project-commit-graph>
      <div className="grid border-b bg-muted/40 text-xs text-muted-foreground lg:grid-cols-[156px_minmax(0,1fr)_320px]">
        <div className="border-r px-3 py-2">分支 / 作者</div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_88px]">
          <div className="border-r px-3 py-2">图谱</div>
          <div className="px-3 py-2">提交消息</div>
          <div className="px-3 py-2 text-right">日期</div>
        </div>
        <div className="hidden border-l px-3 py-2 lg:block">节点详情</div>
      </div>
      <div className="grid lg:grid-cols-[156px_minmax(0,1fr)_320px]">
        <div className="border-b bg-muted/20 p-2 lg:border-b-0 lg:border-r">
          <div className="space-y-2">
            {graph.lanes.map((lane, index) => (
              <button
                key={lane.authorId}
                type="button"
                data-project-author-lane
                onClick={() => {
                  const firstRow = graph.rows.find((row) => row.authorId === lane.authorId);
                  if (firstRow) setSelectedId(firstRow.id);
                }}
                className="flex w-full items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ backgroundColor: lane.color }}>
                  {index + 1}
                </span>
                <span className="min-w-0 truncate">{lane.authorName}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0 overflow-auto">
          <div className="min-w-[640px]">
            {graph.rows.map((row) => (
              <CommitGraphRowButton
                key={row.id}
                row={row}
                laneCount={Math.max(graph.lanes.length, 1)}
                selected={row.id === selectedRow?.id}
                onSelect={() => setSelectedId(row.id)}
              />
            ))}
          </div>
        </div>
        {selectedRow ? (
          <CommitInspector row={selectedRow} viewerId={viewerId} canManageNodeActions={canManageNodeActions} />
        ) : null}
      </div>
    </div>
  );
}
