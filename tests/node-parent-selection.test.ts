import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeProjectNodeParentInput,
  PROJECT_NODE_ROOT_PARENT_VALUE,
} from "../src/features/projects/lib/node-parent-selection";

test("项目节点父级表单值应区分显式根节点和未选择父节点", () => {
  assert.equal(normalizeProjectNodeParentInput(PROJECT_NODE_ROOT_PARENT_VALUE), null);
  assert.equal(normalizeProjectNodeParentInput(""), undefined);
  assert.equal(normalizeProjectNodeParentInput(null), undefined);
  assert.equal(normalizeProjectNodeParentInput("node-1"), "node-1");
  assert.equal(normalizeProjectNodeParentInput(" node-1 "), "node-1");
});
