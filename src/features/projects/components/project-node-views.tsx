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
    <div className="space-y-4">
      <h2 className="text-base font-semibold tracking-[-0.015em]">项目节点</h2>
      <CommitGraphView viewerId={viewerId} nodes={canvasNodes} canManageNodeActions={canManageNodeActions} />
    </div>
  );
}
