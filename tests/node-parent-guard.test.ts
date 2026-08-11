import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECT_NODE_PARENT_INVALID_MESSAGE,
  assertProjectNodeParentChainAllowed,
  assertProjectNodeParentAllowed,
  buildProjectNodeParentLookupWhere,
} from "../src/features/projects/lib/node-parent-guard";

test("项目节点父节点查询必须限定同项目且未软删", () => {
  assert.deepEqual(buildProjectNodeParentLookupWhere("node-1", "project-1"), {
    id: "node-1",
    projectId: "project-1",
    deletedAt: null,
  });
});

test("跨项目或已软删父节点应被拒绝", () => {
  assert.doesNotThrow(() => assertProjectNodeParentAllowed({ id: "node-1" }));
  assert.throws(() => assertProjectNodeParentAllowed(null), new RegExp(PROJECT_NODE_PARENT_INVALID_MESSAGE));
});

test("节点改挂父节点时拒绝自身与后代，避免形成循环", () => {
  assert.doesNotThrow(() => assertProjectNodeParentChainAllowed("node-1", ["node-2", "node-3"]));
  assert.throws(
    () => assertProjectNodeParentChainAllowed("node-1", ["node-2", "node-1"]),
    new RegExp(PROJECT_NODE_PARENT_INVALID_MESSAGE),
  );
  assert.throws(
    () => assertProjectNodeParentChainAllowed("node-1", ["node-2", "node-2"]),
    new RegExp(PROJECT_NODE_PARENT_INVALID_MESSAGE),
  );
});
