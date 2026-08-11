"use client";

import { CircleAlert, FileText, Flag, GitCommitHorizontal, Lightbulb, Paperclip } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { formatShanghaiDate, formatShanghaiDateTime } from "@/shared/lib/date";
import { cn } from "@/shared/lib/utils";

import { ProjectNodeActions } from "./project-node-actions";
import { buildCommitGraph, type CommitGraphRow } from "../lib/commit-graph";
import {
  COMMIT_AUTHOR_MAX_WIDTH,
  COMMIT_AUTHOR_MIN_WIDTH,
  COMMIT_INSPECTOR_MAX_WIDTH,
  COMMIT_INSPECTOR_MIN_WIDTH,
  COMMIT_LAYOUT_STORAGE_KEY,
  DEFAULT_COMMIT_PANEL_WIDTHS,
  clampCommitPanelWidths,
  parseCommitPanelWidths,
  type CommitPanelWidths,
} from "../lib/commit-layout";
import { isCommitRowDimmed, isCommitRowHighlighted } from "../lib/commit-selection";
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
  return formatShanghaiDate(value).slice(5);
}

function formatNodeDateTime(value: string) {
  return formatShanghaiDateTime(value);
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
  selectedAuthorId,
  minWidth,
  laneX,
}: {
  rows: readonly CommitGraphRow[];
  lanes: readonly { authorId: string; color: string }[];
  selectedId: string | null;
  selectedAuthorId: string | null;
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
          opacity={selectedAuthorId ? (lane.authorId === selectedAuthorId ? 0.9 : 0.12) : 0.5}
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
        const opacity = selectedAuthorId ? (row.authorId === selectedAuthorId ? 0.95 : 0.12) : 0.88;
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
              opacity={opacity}
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
            opacity={opacity}
          />
        );
      })}
      {rows.map((row, rowIndex) => {
        const selected = isCommitRowHighlighted(row, { selectedId, selectedAuthorId });
        const dimmed = isCommitRowDimmed(row, { selectedId, selectedAuthorId });
        const x = laneX(row.laneIndex);
        const y = rowY(rowIndex);
        return (
          <g key={row.id} opacity={dimmed ? 0.25 : 1} className="transition-opacity duration-[var(--motion-fast)] ease-[var(--ease-fluid)]">
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
  dimmed,
  onSelect,
  index,
  detailOffset,
}: {
  row: CommitGraphRow;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
  index: number;
  detailOffset: number;
}) {
  const meta = nodeMeta[row.nodeType];
  const Icon = meta.icon;

  return (
    <button
      type="button"
      id={`project-node-${row.id}`}
      data-project-commit-row
      data-selected={selected ? "true" : undefined}
      onClick={onSelect}
      style={{ top: index * rowHeight, height: rowHeight }}
      className={cn(
        "absolute left-0 flex w-full items-center border-b border-border/60 text-left transition-[background-color,border-color,box-shadow,opacity] duration-[var(--motion-fast)] ease-[var(--ease-fluid)] hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        selected ? "bg-primary/[0.08]" : "bg-transparent",
        dimmed && "opacity-35",
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
              <span className="h-2 w-2 rounded-full bg-[var(--node-color)]" style={{ "--node-color": row.color } as CSSProperties} aria-hidden="true" />
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

function CommitColumnResizer({
  panel,
  widths,
  containerRef,
  onChange,
}: {
  panel: "author" | "inspector";
  widths: CommitPanelWidths;
  containerRef: RefObject<HTMLDivElement | null>;
  onChange: (widths: CommitPanelWidths) => void;
}) {
  const dragStart = useRef<{ clientX: number; widths: CommitPanelWidths } | null>(null);
  const min = panel === "author" ? COMMIT_AUTHOR_MIN_WIDTH : COMMIT_INSPECTOR_MIN_WIDTH;
  const max = panel === "author" ? COMMIT_AUTHOR_MAX_WIDTH : COMMIT_INSPECTOR_MAX_WIDTH;
  const value = widths[panel];

  function resize(boundaryDelta: number) {
    const base = dragStart.current?.widths ?? widths;
    const next = panel === "author"
      ? { ...base, author: base.author + boundaryDelta }
      : { ...base, inspector: base.inspector - boundaryDelta };
    onChange(clampCommitPanelWidths(next, containerRef.current?.getBoundingClientRect().width));
  }

  return (
    <div
      role="separator"
      aria-label={panel === "author" ? "调整作者栏宽度" : "调整节点详情栏宽度"}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      tabIndex={0}
      className="group relative hidden cursor-col-resize touch-none bg-border/60 outline-none transition-colors duration-[var(--motion-fast)] ease-[var(--ease-fluid)] hover:bg-primary/40 focus-visible:bg-primary/50 lg:block"
      onDoubleClick={() => onChange(DEFAULT_COMMIT_PANEL_WIDTHS)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 12 : -12;
        resize(delta);
      }}
      onPointerDown={(event) => {
        dragStart.current = { clientX: event.clientX, widths };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!dragStart.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        resize(event.clientX - dragStart.current.clientX);
      }}
      onPointerUp={(event) => {
        dragStart.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { dragStart.current = null; }}
    >
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-border transition-colors duration-[var(--motion-fast)] ease-[var(--ease-fluid)] group-hover:bg-primary" aria-hidden="true" />
    </div>
  );
}

function CommitInspector({
  row,
  viewerId,
  canManageNodeActions,
  canManageAllNodes,
}: {
  row: CommitGraphRow;
  viewerId: string;
  canManageNodeActions: boolean;
  canManageAllNodes: boolean;
}) {
  const meta = nodeMeta[row.nodeType];
  const Icon = meta.icon;
  const canEditNode = canManageNodeActions && (canManageAllNodes || row.authorId === viewerId);
  const canDeleteNode = canManageNodeActions && (canManageAllNodes || row.authorId === viewerId);

  return (
    <aside className="flex min-h-[520px] flex-col border-l border-border/80 bg-muted/15" data-project-commit-inspector>
      <div className="border-b border-border/80 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <Badge className={meta.className}>
            <Icon className="mr-1 h-3 w-3" />
            {meta.label}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatNodeDateTime(row.createdAt)}</span>
        </div>
        <h3 className="mt-3 text-base font-semibold leading-6 tracking-[-0.015em]">{row.title}</h3>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--node-color)]" style={{ "--node-color": row.color } as CSSProperties} aria-hidden="true" />
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
      <div className="border-t border-border/80 px-4 py-3">
        {canEditNode ? (
          <ProjectNodeActions projectId={row.projectId} nodeId={row.id} canDelete={canDeleteNode} />
        ) : (
          <p className="text-xs text-muted-foreground">节点由作者维护；项目负责人和负责导师可以管理全部节点。</p>
        )}
      </div>
    </aside>
  );
}

export function CommitGraphView({
  nodes,
  viewerId,
  canManageNodeActions,
  canManageAllNodes,
}: {
  nodes: readonly ProjectCanvasSourceNode[];
  viewerId: string;
  canManageNodeActions: boolean;
  canManageAllNodes: boolean;
}) {
  const graph = useMemo(() => buildCommitGraph(nodes), [nodes]);
  const [selectedId, setSelectedId] = useState<string | null>(graph.rows[0]?.id ?? null);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(null);
  const [panelWidths, setPanelWidths] = useState(DEFAULT_COMMIT_PANEL_WIDTHS);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRow = graph.rows.find((row) => row.id === selectedId) ?? graph.rows[0] ?? null;
  const metrics = getCommitGraphMetrics(Math.max(graph.lanes.length, 1));
  const graphHeight = graph.rows.length * rowHeight;

  useEffect(() => {
    setPanelWidths(parseCommitPanelWidths(window.localStorage.getItem(COMMIT_LAYOUT_STORAGE_KEY)));
  }, []);

  function updatePanelWidths(next: CommitPanelWidths) {
    setPanelWidths(next);
    window.localStorage.setItem(COMMIT_LAYOUT_STORAGE_KEY, JSON.stringify(next));
  }

  if (graph.rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-card px-4 py-12 text-center text-sm text-muted-foreground">
        暂无项目节点。
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="overflow-x-auto rounded-3xl border border-white/60 bg-card shadow-[var(--shadow-surface)] focus-within:ring-2 focus-within:ring-ring/20 dark:border-border/80"
      data-project-commit-graph
      style={{
        "--project-author-width": `${panelWidths.author}px`,
        "--project-inspector-width": `${panelWidths.inspector}px`,
      } as CSSProperties}
    >
      <div className="grid grid-cols-[156px_minmax(0,1fr)] border-b border-border/80 bg-muted/60 text-xs font-medium text-muted-foreground lg:grid-cols-[var(--project-author-width)_8px_minmax(360px,1fr)_8px_var(--project-inspector-width)]">
        <div className="border-r border-border/80 px-3 py-2.5">作者</div>
        <div className="hidden lg:block" aria-hidden="true" />
        <div className="px-3 py-2.5">提交详情</div>
        <div className="hidden lg:block" aria-hidden="true" />
        <div className="hidden border-l border-border/80 px-3 py-2.5 lg:block">节点详情</div>
      </div>
      <div className="grid lg:grid-cols-[var(--project-author-width)_8px_minmax(360px,1fr)_8px_var(--project-inspector-width)]">
        <div className="border-b border-border/80 bg-muted/20 p-2.5 lg:border-b-0 lg:border-r">
          <div className="space-y-2">
            {graph.lanes.map((lane, index) => (
              <button
                key={lane.authorId}
                type="button"
                data-project-author-lane
                aria-pressed={selectedAuthorId === lane.authorId}
                onClick={() => {
                  const firstRow = graph.rows.find((row) => row.authorId === lane.authorId);
                  if (firstRow) setSelectedId(firstRow.id);
                  setSelectedAuthorId((current) => current === lane.authorId ? null : lane.authorId);
                }}
                className={cn(
                  "flex min-h-9 w-full items-center gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-1.5 text-left text-xs transition-[color,border-color,background-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-fluid)] hover:border-foreground/20 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedAuthorId === lane.authorId && "border-primary/60 bg-primary/[0.08] text-primary",
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--node-color)] text-[11px] font-semibold text-white" style={{ "--node-color": lane.color } as CSSProperties}>
                  {index + 1}
                </span>
                <span className="min-w-0 truncate">{lane.authorName}</span>
              </button>
            ))}
          </div>
        </div>
        <CommitColumnResizer panel="author" widths={panelWidths} containerRef={containerRef} onChange={updatePanelWidths} />
        <div className="min-w-0 overflow-auto">
          <div className="relative" style={{ minWidth: metrics.minWidth, height: graphHeight }}>
            <CommitGraphCanvas
              rows={graph.rows}
              lanes={graph.lanes}
              selectedId={selectedRow?.id ?? null}
              selectedAuthorId={selectedAuthorId}
              minWidth={metrics.minWidth}
              laneX={metrics.laneX}
            />
            {graph.rows.map((row, index) => (
              <CommitGraphRowButton
                key={row.id}
                row={row}
                selected={isCommitRowHighlighted(row, { selectedId: selectedRow?.id ?? null, selectedAuthorId })}
                dimmed={isCommitRowDimmed(row, { selectedId: selectedRow?.id ?? null, selectedAuthorId })}
                onSelect={() => {
                  setSelectedId(row.id);
                  setSelectedAuthorId(null);
                }}
                index={index}
                detailOffset={metrics.detailOffset}
              />
            ))}
          </div>
        </div>
        <CommitColumnResizer panel="inspector" widths={panelWidths} containerRef={containerRef} onChange={updatePanelWidths} />
        {selectedRow ? (
          <CommitInspector
            row={selectedRow}
            viewerId={viewerId}
            canManageNodeActions={canManageNodeActions}
            canManageAllNodes={canManageAllNodes}
          />
        ) : null}
      </div>
    </div>
  );
}
