import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeProjectMemberUserIds,
  resolveProjectCreationAssignments,
} from "../src/features/projects/lib/create-project";
import { projectScopedTagName } from "../src/features/projects/lib/tag-grants";
import { projectInputSchema } from "../src/shared/lib/validators/projects";

test("创建项目必须显式选择组长", () => {
  assert.equal(projectInputSchema.safeParse({ name: "新项目" }).success, false);
  assert.equal(projectInputSchema.safeParse({ name: "新项目", leadUserId: "lead-1" }).success, true);
});

test("创建项目应去重组员并避免把组长重复授予 member 标签", () => {
  assert.deepEqual(normalizeProjectMemberUserIds("lead-1", ["member-1", "lead-1", "member-1", "member-2"]), [
    "member-1",
    "member-2",
  ]);
});

test("创建者不应自动成为组长，除非表单显式选择创建者", () => {
  assert.deepEqual(
    resolveProjectCreationAssignments({
      creatorUserId: "creator-1",
      leadUserId: "lead-1",
      memberUserIds: [],
    }),
    { leadUserId: "lead-1", memberUserIds: [] },
  );
});

test("项目 scoped Tag 名称应稳定生成", () => {
  assert.equal(projectScopedTagName("lead", "project-1"), "project-lead:project-1");
  assert.equal(projectScopedTagName("member", "project-1"), "project-member:project-1");
});
