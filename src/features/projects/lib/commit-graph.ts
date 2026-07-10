import { buildAuthorLegend, resolveAuthorColor } from "./author-color";
import type { ProjectCanvasSourceNode } from "./node-canvas";

export type CommitGraphRow = ProjectCanvasSourceNode & {
  laneIndex: number;
  parentLaneIndex: number | null;
  childLaneIndexes: number[];
  color: string;
};

function compareCommitRows(left: ProjectCanvasSourceNode, right: ProjectCanvasSourceNode) {
  const timeCompare = right.createdAt.localeCompare(left.createdAt);
  if (timeCompare !== 0) return timeCompare;
  return right.id.localeCompare(left.id);
}

export function buildCommitGraph(nodes: readonly ProjectCanvasSourceNode[]) {
  const lanes = buildAuthorLegend(nodes);
  const laneByAuthor = new Map(lanes.map((lane, index) => [lane.authorId, index]));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, ProjectCanvasSourceNode[]>();

  for (const node of nodes) {
    if (!node.parentId || !byId.has(node.parentId)) continue;
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }

  const rows: CommitGraphRow[] = [...nodes].sort(compareCommitRows).map((node) => {
    const laneIndex = laneByAuthor.get(node.authorId) ?? 0;
    const parent = node.parentId ? byId.get(node.parentId) : null;
    const parentLaneIndex = parent ? (laneByAuthor.get(parent.authorId) ?? null) : null;
    const childLaneIndexes = (childrenByParent.get(node.id) ?? [])
      .map((child) => laneByAuthor.get(child.authorId))
      .filter((laneIndex): laneIndex is number => typeof laneIndex === "number");

    return {
      ...node,
      laneIndex,
      parentLaneIndex,
      childLaneIndexes,
      color: resolveAuthorColor({ authorId: node.authorId, colorHex: node.colorHex }),
    };
  });

  return { lanes, rows };
}
