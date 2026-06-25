import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthorLegend,
  colorForAuthor,
  resolveAuthorColor,
} from "../src/features/projects/lib/author-color";
import type { ProjectCanvasSourceNode } from "../src/features/projects/lib/node-canvas";

function node(input: Partial<ProjectCanvasSourceNode> & Pick<ProjectCanvasSourceNode, "id" | "authorId" | "authorName">): ProjectCanvasSourceNode {
  return {
    id: input.id,
    projectId: input.projectId ?? "project-1",
    title: input.title ?? input.id,
    description: input.description,
    nodeType: input.nodeType ?? "UPDATE",
    parentId: input.parentId ?? null,
    authorId: input.authorId,
    authorName: input.authorName,
    createdAt: input.createdAt ?? "2026-06-25",
    colorHex: input.colorHex,
  };
}

test("作者颜色应按 authorId 稳定生成", () => {
  assert.equal(colorForAuthor("author-a"), colorForAuthor("author-a"));
  assert.match(colorForAuthor("author-a"), /^#[0-9a-f]{6}$/);
});

test("不同作者应落到固定调色板的多个颜色", () => {
  const colors = new Set(["author-a", "author-b", "author-c", "author-d"].map(colorForAuthor));
  assert.ok(colors.size > 1);
});

test("节点显式 colorHex 应优先于作者哈希色", () => {
  assert.equal(resolveAuthorColor({ authorId: "author-a", colorHex: "#123abc" }), "#123abc");
  assert.equal(resolveAuthorColor({ authorId: "author-a", colorHex: "not-a-color" }), colorForAuthor("author-a"));
});

test("作者图例应按作者去重并保留首个作者颜色", () => {
  const legend = buildAuthorLegend([
    node({ id: "n1", authorId: "author-a", authorName: "张三", colorHex: "#123abc" }),
    node({ id: "n2", authorId: "author-a", authorName: "张三", colorHex: "#456def" }),
    node({ id: "n3", authorId: "author-b", authorName: "李四" }),
  ]);

  assert.deepEqual(legend.map((item) => item.authorName), ["张三", "李四"]);
  assert.equal(legend[0]?.color, "#123abc");
});
