"use client";

import { CommitGraphView } from "./commit-graph-view";
import type { ProjectCanvasSourceNode } from "../lib/node-canvas";
import { SectionHeader } from "@/shared/components/ui/page-header";

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
    <section className="space-y-5">
      <SectionHeader title="项目节点" description={`${canvasNodes.length} 个节点，按时间与作者关系呈现。选择作者或节点可检查对应上下文。`} />
      <CommitGraphView viewerId={viewerId} nodes={canvasNodes} canManageNodeActions={canManageNodeActions} />
    </section>
  );
}
