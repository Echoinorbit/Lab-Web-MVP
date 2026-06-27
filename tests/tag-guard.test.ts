import assert from "node:assert/strict";
import test from "node:test";

import {
  assertManuallyManageableTagName,
  isProjectManagedTagName,
} from "../src/features/tags/lib/project-tag-guard";

test("项目组 scoped Tag 应由项目流程托管，不能手动管理", () => {
  assert.equal(isProjectManagedTagName("project-lead:project-1"), true);
  assert.equal(isProjectManagedTagName("project-member:project-1"), true);
  assert.throws(() => assertManuallyManageableTagName("project-lead:project-1"), /项目流程自动管理/);
  assert.throws(() => assertManuallyManageableTagName("project-member:project-1"), /项目流程自动管理/);
});

test("GLOBAL Tag 和相似前缀不应被项目 Tag 守卫误伤", () => {
  assert.equal(isProjectManagedTagName("advisor"), false);
  assert.equal(isProjectManagedTagName("project-lead"), false);
  assert.equal(isProjectManagedTagName("project-leader:project-1"), false);
  assert.doesNotThrow(() => assertManuallyManageableTagName("advisor"));
});

test("毕业 Tag 仅保留历史迁移用途，不能手动授予或撤销", () => {
  assert.throws(() => assertManuallyManageableTagName("graduated"), /毕业状态/);
});
