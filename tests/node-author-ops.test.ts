import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECT_NODE_AUTHOR_ONLY_MESSAGE,
  ProjectNodeAuthorError,
  resolveProjectNodeAuthorAccess,
} from "../src/features/projects/lib/node-author-ops";
import {
  deleteProjectNodeInputSchema,
  updateProjectNodeInputSchema,
} from "../src/shared/lib/validators/projects";

test("节点作者本人可以编辑或删除自己的节点", () => {
  assert.deepEqual(
    resolveProjectNodeAuthorAccess({
      userId: "author-1",
      authorId: "author-1",
    }),
    { allowed: true, scope: "author" },
  );
});

test("项目组长仅凭 lead 身份不能编辑或删除他人节点", () => {
  assert.deepEqual(
    resolveProjectNodeAuthorAccess({
      userId: "lead-1",
      authorId: "author-1",
      isProjectLead: true,
    }),
    { allowed: false, scope: "denied", reason: "author_only" },
  );
});

test("节点作者越权错误应使用固定中文提示", () => {
  assert.equal(new ProjectNodeAuthorError().message, PROJECT_NODE_AUTHOR_ONLY_MESSAGE);
});

test("节点编辑与删除输入契约应保留显式 nodeId", () => {
  assert.equal(
    updateProjectNodeInputSchema.safeParse({
      nodeId: "node-1",
      title: "有效节点",
      description: "说明",
      nodeType: "UPDATE",
    }).success,
    true,
  );
  assert.equal(deleteProjectNodeInputSchema.safeParse({ nodeId: "node-1" }).success, true);
  assert.equal(deleteProjectNodeInputSchema.safeParse({}).success, false);
});
