"use client";

import { CommitGraphView } from "./commit-graph-view";
import type { ProjectCanvasSourceNode } from "../lib/node-canvas";

export function ProjectNodeViews({
  viewerId,
  canvasNodes,
  canManageNodeActions,
}: {
  viewerId: string;
  canvasNodes: readonly ProjectCanvasSourceNode[];
  canManageNodeActions: boolean;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">项目节点</h2>
      <CommitGraphView viewerId={viewerId} nodes={canvasNodes} canManageNodeActions={canManageNodeActions} />
    </div>
  );
}
