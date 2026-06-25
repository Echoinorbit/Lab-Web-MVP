import assert from "node:assert/strict";
import test from "node:test";

import {
  mapProjectNodesToCanvas,
  type ProjectCanvasSourceNode,
} from "../src/features/projects/lib/node-canvas";

function node(input: Partial<ProjectCanvasSourceNode> & Pick<ProjectCanvasSourceNode, "id">): ProjectCanvasSourceNode {
  return {
    id: input.id,
    projectId: input.projectId ?? "project-1",
    title: input.title ?? input.id,
    description: input.description,
    nodeType: input.nodeType ?? "UPDATE",
    parentId: input.parentId ?? null,
    authorId: input.authorId ?? "author-1",
    authorName: input.authorName ?? "作者",
    createdAt: input.createdAt ?? "2026-06-25",
    colorHex: input.colorHex,
  };
}

test("项目节点画布映射应保留父子连线", () => {
  const result = mapProjectNodesToCanvas([
    node({ id: "root" }),
    node({ id: "child-a", parentId: "root" }),
    node({ id: "child-b", parentId: "root" }),
  ]);

  assert.equal(result.nodes.length, 3);
  assert.deepEqual(
    result.edges.map((edge) => [edge.source, edge.target]),
    [
      ["root", "child-a"],
      ["root", "child-b"],
    ],
  );
});

test("画布布局应按树深度拉开层级，并将父节点置于子节点中间", () => {
  const result = mapProjectNodesToCanvas([
    node({ id: "root" }),
    node({ id: "left", parentId: "root" }),
    node({ id: "right", parentId: "root" }),
  ]);
  const positions = new Map(result.nodes.map((flowNode) => [flowNode.id, flowNode.position]));

  assert.equal(positions.get("left")?.y, 170);
  assert.equal(positions.get("right")?.y, 170);
  assert.equal(positions.get("root")?.x, 160);
});

test("缺失父节点的项目节点应作为根节点呈现且不生成悬空边", () => {
  const result = mapProjectNodesToCanvas([
    node({ id: "root" }),
    node({ id: "orphan", parentId: "missing" }),
  ]);

  assert.equal(result.nodes.length, 2);
  assert.deepEqual(result.edges, []);
  assert.equal(result.nodes.find((flowNode) => flowNode.id === "orphan")?.position.y, 0);
});
