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

const rowHeight = 64;
const laneGap = 28;
const graphPadding = 20;

function truncateText(value: string | undefined, maxLength: number) {
  if (!value) return "";
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}...` : compact;
}

function formatNodeDate(value: string) {
  const date = value.includes("T") ? value.slice(0, 10) : value;
  return date.length >= 10 ? date.slice(5, 10) : date;
}

function formatNodeDateTime(value: string) {
  if (!value.includes("T")) return value;
  return `${value.slice(0, 10)} ${value.slice(11, 16)}`;
}

function getCommitGraphMetrics(laneCount: number) {
  const laneWidth = graphPadding * 2 + Math.max(laneCount - 1, 0) * laneGap;
  const detailOffset = Math.max(132, laneWidth + 44);
  return {
    detailOffset,
    minWidth: Math.max(680, detailOffset + 520),
    laneX: (laneIndex: number) => graphPadding + laneIndex * laneGap,
  };
}

function CommitGraphCanvas({
  rows,
  lanes,
  selectedId,
  minWidth,
  laneX,
}: {
  rows: readonly CommitGraphRow[];
  lanes: readonly { authorId: string; color: string }[];
  selectedId: string | null;
  minWidth: number;
  laneX: (laneIndex: number) => number;
}) {
  const height = rows.length * rowHeight;
  const rowIndexById = new Map(rows.map((row, index) => [row.id, index]));
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const rowY = (index: number) => index * rowHeight + rowHeight / 2;

  return (
    <svg
      aria-hidden="true"
      width={minWidth}
      height={height}
      viewBox={`0 0 ${minWidth} ${height}`}
      className="pointer-events-none absolute inset-0"
    >
      {lanes.map((lane, laneIndex) => (
        <line
          key={lane.authorId}
          x1={laneX(laneIndex)}
          y1={0}
          x2={laneX(laneIndex)}
          y2={height}
          stroke={lane.color}
          strokeWidth={2}
          opacity={0.5}
        />
      ))}
      {rows.map((row, rowIndex) => {
        if (!row.parentId) return null;
        const parent = rowById.get(row.parentId);
        const parentIndex = rowIndexById.get(row.parentId);
        if (!parent || parentIndex === undefined) return null;
        const startX = laneX(row.laneIndex);
        const startY = rowY(rowIndex);
        const endX = laneX(parent.laneIndex);
        const endY = rowY(parentIndex);
        if (startX === endX) {
          return (
            <line
              key={`${row.id}-${row.parentId}`}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={row.color}
              strokeWidth={2}
              opacity={0.88}
            />
          );
        }
        const midY = (startY + endY) / 2;
        return (
          <path
            key={`${row.id}-${row.parentId}`}
            d={`M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`}
            fill="none"
            stroke={row.color}
            strokeWidth={2}
            opacity={0.88}
          />
        );
      })}
      {rows.map((row, rowIndex) => {
        const selected = row.id === selectedId;
        const x = laneX(row.laneIndex);
        const y = rowY(rowIndex);
        return (
          <g key={row.id}>
            <circle cx={x} cy={y} r={selected ? 10 : 8} fill="hsl(var(--card))" stroke={row.color} strokeWidth={selected ? 3 : 2} />
            <circle cx={x} cy={y} r={5} fill={row.color} />
            {selected ? <circle cx={x} cy={y} r={14} fill="none" stroke={row.color} strokeWidth={1.5} opacity={0.35} /> : null}
          </g>
        );
      })}
    </svg>
  );
}

function CommitGraphRowButton({
  row,
  selected,
  onSelect,
  index,
  detailOffset,
}: {
  row: CommitGraphRow;
  selected: boolean;
  onSelect: () => void;
  index: number;
  detailOffset: number;
}) {
  const meta = nodeMeta[row.nodeType];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      data-project-commit-row
      data-selected={selected ? "true" : undefined}
      onClick={onSelect}
      style={{ top: index * rowHeight, height: rowHeight }}
      className={cn(
        "absolute left-0 flex w-full items-center border-b border-border/60 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "bg-primary/10" : "bg-transparent",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 pr-3" style={{ paddingLeft: detailOffset }}>
        <Badge className={cn("shrink-0", meta.className)}>
          <Icon className="mr-1 h-3 w-3" />
          {meta.label}
        </Badge>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{row.title}</div>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex min-w-0 shrink-0 items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
              {row.authorName}
            </span>
            {row.description ? <span className="min-w-0 truncate">{truncateText(row.description, 72)}</span> : null}
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formatNodeDate(row.createdAt)}</span>
      </div>
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
          <span className="text-xs text-muted-foreground">{formatNodeDateTime(row.createdAt)}</span>
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
          <p className="text-xs text-muted-foreground">节点由作者维护；项目组中其它成员不能修改他人节点。</p>
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
  const metrics = getCommitGraphMetrics(Math.max(graph.lanes.length, 1));
  const graphHeight = graph.rows.length * rowHeight;

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
        <div className="border-r px-3 py-2">作者</div>
        <div className="px-3 py-2">提交详情</div>
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
          <div className="relative" style={{ minWidth: metrics.minWidth, height: graphHeight }}>
            <CommitGraphCanvas
              rows={graph.rows}
              lanes={graph.lanes}
              selectedId={selectedRow?.id ?? null}
              minWidth={metrics.minWidth}
              laneX={metrics.laneX}
            />
            {graph.rows.map((row, index) => (
              <CommitGraphRowButton
                key={row.id}
                row={row}
                selected={row.id === selectedRow?.id}
                onSelect={() => setSelectedId(row.id)}
                index={index}
                detailOffset={metrics.detailOffset}
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
