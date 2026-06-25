import type { Edge, Node } from "@xyflow/react";

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

export function mapProjectNodesToCanvas(nodes: readonly ProjectCanvasSourceNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, ProjectCanvasSourceNode[]>();

  for (const node of nodes) {
    if (!node.parentId || !byId.has(node.parentId)) continue;
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }

  const roots = nodes.filter((node) => !node.parentId || !byId.has(node.parentId));
  const positions = new Map<string, { x: number; y: number }>();
  let nextLeaf = 0;

  function placeSubtree(node: ProjectCanvasSourceNode, depth: number): number {
    const children = childrenByParent.get(node.id) ?? [];
    if (children.length === 0) {
      const x = nextLeaf * horizontalGap;
      nextLeaf += 1;
      positions.set(node.id, { x, y: depth * verticalGap });
      return x;
    }

    const childXs = children.map((child) => placeSubtree(child, depth + 1));
    const x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    positions.set(node.id, { x, y: depth * verticalGap });
    return x;
  }

  for (const root of roots) {
    placeSubtree(root, 0);
    nextLeaf += 1;
  }

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
