import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECT_NODE_MANAGER_ONLY_MESSAGE,
  ProjectNodeManagerError,
  resolveProjectNodeManagerAccess,
} from "../src/features/projects/lib/node-author-ops";
import {
  deleteProjectNodeInputSchema,
  updateProjectNodeInputSchema,
} from "../src/shared/lib/validators/projects";

test("节点作者可以管理自己的节点", () => {
  assert.deepEqual(
    resolveProjectNodeManagerAccess({
      userId: "author-1",
      authorId: "author-1",
      canManageProjectNodes: false,
    }),
    { allowed: true, scope: "author" },
  );
});

test("项目负责人和有效负责导师可以管理项目内任意节点", () => {
  for (const userId of ["lead-1", "advisor-1"]) {
    assert.deepEqual(
      resolveProjectNodeManagerAccess({
        userId,
        authorId: "author-1",
        canManageProjectNodes: true,
      }),
      { allowed: true, scope: "project_manager" },
    );
  }
});

test("无项目管理资格的其他成员不能修改他人节点", () => {
  assert.deepEqual(
    resolveProjectNodeManagerAccess({
      userId: "member-1",
      authorId: "author-1",
      canManageProjectNodes: false,
    }),
    { allowed: false, scope: "denied", reason: "node_manager_only" },
  );
});

test("节点管理越权错误应使用固定中文提示", () => {
  assert.equal(new ProjectNodeManagerError().message, PROJECT_NODE_MANAGER_ONLY_MESSAGE);
});

test("节点编辑与删除输入契约保留显式 nodeId 和可选父节点", () => {
  assert.equal(
    updateProjectNodeInputSchema.safeParse({
      nodeId: "node-1",
      parentId: "node-0",
      title: "有效节点",
      description: "说明",
      nodeType: "UPDATE",
    }).success,
    true,
  );
  assert.equal(deleteProjectNodeInputSchema.safeParse({ nodeId: "node-1" }).success, true);
  assert.equal(deleteProjectNodeInputSchema.safeParse({}).success, false);
});
