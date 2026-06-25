import assert from "node:assert/strict";
import test from "node:test";

import { buildCommitGraph } from "../src/features/projects/lib/commit-graph";
import type { ProjectCanvasSourceNode } from "../src/features/projects/lib/node-canvas";

function node(input: Partial<ProjectCanvasSourceNode> & Pick<ProjectCanvasSourceNode, "id" | "authorId" | "authorName" | "createdAt">): ProjectCanvasSourceNode {
  return {
    id: input.id,
    projectId: input.projectId ?? "project-1",
    title: input.title ?? input.id,
    description: input.description,
    nodeType: input.nodeType ?? "UPDATE",
    parentId: input.parentId ?? null,
    authorId: input.authorId,
    authorName: input.authorName,
    createdAt: input.createdAt,
    colorHex: input.colorHex,
  };
}

test("commit graph 应按时间倒序呈现提交节点", () => {
  const graph = buildCommitGraph([
    node({ id: "older", authorId: "author-a", authorName: "甲", createdAt: "2026-06-01" }),
    node({ id: "newer", authorId: "author-a", authorName: "甲", createdAt: "2026-06-03" }),
  ]);

  assert.deepEqual(graph.rows.map((row) => row.id), ["newer", "older"]);
});

test("commit graph 应按作者生成稳定 lane 并记录父节点 lane", () => {
  const graph = buildCommitGraph([
    node({ id: "root", authorId: "author-a", authorName: "甲", createdAt: "2026-06-01", colorHex: "#123abc" }),
    node({ id: "child", authorId: "author-b", authorName: "乙", createdAt: "2026-06-02", parentId: "root" }),
  ]);

  assert.deepEqual(graph.lanes.map((lane) => lane.authorName), ["甲", "乙"]);
  const child = graph.rows.find((row) => row.id === "child");
  const root = graph.rows.find((row) => row.id === "root");
  assert.equal(child?.laneIndex, 1);
  assert.equal(child?.parentLaneIndex, 0);
  assert.deepEqual(root?.childLaneIndexes, [1]);
  assert.equal(root?.color, "#123abc");
});
