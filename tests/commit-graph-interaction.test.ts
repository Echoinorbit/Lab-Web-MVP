import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_COMMIT_PANEL_WIDTHS,
  clampCommitPanelWidths,
  parseCommitPanelWidths,
} from "../src/features/projects/lib/commit-layout";
import { isCommitRowDimmed, isCommitRowHighlighted } from "../src/features/projects/lib/commit-selection";

const first = { id: "node-1", authorId: "author-a" };
const second = { id: "node-2", authorId: "author-a" };
const other = { id: "node-3", authorId: "author-b" };

test("选择作者时应高亮该作者全部节点并淡化其他作者", () => {
  const selection = { selectedId: "node-1", selectedAuthorId: "author-a" };
  assert.equal(isCommitRowHighlighted(first, selection), true);
  assert.equal(isCommitRowHighlighted(second, selection), true);
  assert.equal(isCommitRowHighlighted(other, selection), false);
  assert.equal(isCommitRowDimmed(other, selection), true);
});

test("选择单节点时只高亮该节点且不淡化其他作者", () => {
  const selection = { selectedId: "node-1", selectedAuthorId: null };
  assert.equal(isCommitRowHighlighted(first, selection), true);
  assert.equal(isCommitRowHighlighted(second, selection), false);
  assert.equal(isCommitRowDimmed(other, selection), false);
});

test("提交图分栏宽度应校验持久化值并为中间画布保留最小空间", () => {
  assert.deepEqual(parseCommitPanelWidths("bad-json"), DEFAULT_COMMIT_PANEL_WIDTHS);
  assert.deepEqual(parseCommitPanelWidths('{"author":80,"inspector":900}'), { author: 120, inspector: 520 });
  const constrained = clampCommitPanelWidths({ author: 280, inspector: 520 }, 900);
  assert.equal(constrained.author + constrained.inspector <= 900 - 360 - 16, true);
});
