import type { Edge, Node } from "@xyflow/react";

import { buildAuthorLegend } from "./author-color";

export type ProjectCanvasNodeType = "MILESTONE" | "UPDATE" | "DECISION" | "ISSUE" | "RESOURCE";

export type ProjectCanvasSourceNode = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  nodeType: ProjectCanvasNodeType;
  parentId: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
  colorHex?: string | null;
};

export type ProjectCanvasNodeData = {
  projectId: string;
  title: string;
  description?: string;
  nodeType: ProjectCanvasNodeType;
  authorId: string;
  authorName: string;
  createdAt: string;
  colorHex?: string | null;
  viewerId?: string;
} & Record<string, unknown>;

export type ProjectFlowNode = Node<ProjectCanvasNodeData, "projectNode">;
export type ProjectFlowEdge = Edge;

const horizontalGap = 320;
const verticalGap = 170;

function compareCanvasRows(left: ProjectCanvasSourceNode, right: ProjectCanvasSourceNode) {
  const timeCompare = right.createdAt.localeCompare(left.createdAt);
  if (timeCompare !== 0) return timeCompare;
  return right.id.localeCompare(left.id);
}

export function mapProjectNodesToCanvas(nodes: readonly ProjectCanvasSourceNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const lanes = buildAuthorLegend(nodes);
  const laneByAuthor = new Map(lanes.map((lane, index) => [lane.authorId, index]));
  const positions = new Map<string, { x: number; y: number }>();

  [...nodes].sort(compareCanvasRows).forEach((node, rowIndex) => {
    positions.set(node.id, {
      x: (laneByAuthor.get(node.authorId) ?? 0) * horizontalGap,
      y: rowIndex * verticalGap,
    });
  });

  const flowNodes: ProjectFlowNode[] = nodes.map((node) => ({
    id: node.id,
    type: "projectNode",
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: {
      projectId: node.projectId,
      title: node.title,
      description: node.description,
      nodeType: node.nodeType,
      authorId: node.authorId,
      authorName: node.authorName,
      createdAt: node.createdAt,
      colorHex: node.colorHex,
    },
  }));

  const flowEdges: ProjectFlowEdge[] = nodes.flatMap((node) => {
    if (!node.parentId || !byId.has(node.parentId)) return [];
    return [
      {
        id: `${node.parentId}->${node.id}`,
        source: node.parentId,
        target: node.id,
        type: "smoothstep",
      },
    ];
  });

  return { nodes: flowNodes, edges: flowEdges };
}
