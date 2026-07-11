import assert from "node:assert/strict";
import test from "node:test";

import {
  assertManualTagTargetEligible,
  assertManuallyManageableTagName,
  isManuallyManageableTagName,
  isProjectManagedTagName,
} from "../src/features/tags/lib/project-tag-guard";

test("项目组 scoped Tag 应由项目流程托管，不能手动管理", () => {
  assert.equal(isProjectManagedTagName("project-lead:project-1"), true);
  assert.equal(isProjectManagedTagName("project-member:project-1"), true);
  assert.throws(() => assertManuallyManageableTagName("project-lead:project-1"), /项目流程自动管理/);
  assert.throws(() => assertManuallyManageableTagName("project-member:project-1"), /项目流程自动管理/);
});

test("培养身份 Tag 受保护，相似前缀与普通 GLOBAL Tag 不被误伤", () => {
  assert.equal(isProjectManagedTagName("advisor"), false);
  assert.equal(isProjectManagedTagName("project-lead"), false);
  assert.equal(isProjectManagedTagName("project-leader:project-1"), false);
  assert.throws(() => assertManuallyManageableTagName("advisor"), /培养身份系统 Tag/);
  assert.throws(() => assertManuallyManageableTagName("grad-master"), /培养身份系统 Tag/);
  assert.throws(() => assertManuallyManageableTagName("grad-phd"), /培养身份系统 Tag/);
  assert.doesNotThrow(() => assertManuallyManageableTagName("advisor-assistant"));
  assert.doesNotThrow(() => assertManuallyManageableTagName("project-leader:project-1"));
});

test("毕业 Tag 仅保留历史迁移用途，不能手动授予或撤销", () => {
  assert.throws(() => assertManuallyManageableTagName("graduated"), /毕业状态/);
});

test("手动 Tag 变更只允许在用普通成员", () => {
  assert.doesNotThrow(() => assertManualTagTargetEligible({ role: "MEMBER", status: "ACTIVE" }));
  assert.throws(() => assertManualTagTargetEligible(null), /目标成员不存在/);
  assert.throws(() => assertManualTagTargetEligible({ role: "ADMIN", status: "ACTIVE" }), /治理账号/);
  assert.throws(() => assertManualTagTargetEligible({ role: "MEMBER", status: "SUSPENDED" }), /在用成员/);
  assert.throws(() => assertManualTagTargetEligible({ role: "MEMBER", status: "GRADUATED" }), /在用成员/);
});

test("Tag 管理 UI 只暴露服务端允许手动维护的 Tag", () => {
  for (const protectedName of ["advisor", "grad-master", "grad-phd", "graduated", "project-lead:p1", "project-member:p1"]) {
    assert.equal(isManuallyManageableTagName(protectedName), false);
  }
  assert.equal(isManuallyManageableTagName("post-moderator"), true);
});
