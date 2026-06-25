import assert from "node:assert/strict";
import test from "node:test";

import {
  PERMISSIONS,
  computeProjectPermissionsFromSnapshot,
  computePermissionsFromSnapshot,
  isEffectiveTag,
  normalizePermissionList,
  describePermission,
  type PermissionTagSnapshot,
} from "../src/shared/lib/permissions";

test("管理员应拥有治理类权限，但不得拥有任何内容创作权限（发帖、评论、建项目）", () => {
  const permissions = computePermissionsFromSnapshot({ role: "ADMIN", status: "ACTIVE", tags: [] });
  assert.equal(permissions.has(PERMISSIONS.ADMIN_USER_MANAGE), true);
  assert.equal(permissions.has(PERMISSIONS.POST_READ), true);
  assert.equal(permissions.has(PERMISSIONS.POST_CREATE), false);
  assert.equal(permissions.has(PERMISSIONS.COMMENT_CREATE), false);
  assert.equal(permissions.has(PERMISSIONS.PROJECT_CREATE), false);
});

test("已停用或不存在的用户应得到一个空的权限集合", () => {
  assert.equal(computePermissionsFromSnapshot(null).size, 0);
  assert.equal(computePermissionsFromSnapshot({ role: "MEMBER", status: "SUSPENDED", tags: [] }).size, 0);
  assert.equal(computePermissionsFromSnapshot({ role: "MEMBER", status: "GRADUATED", tags: [] }).size, 0);
});

test("Tag 实例上的权限应覆盖模板权限，包括显式的空数组（空数组即清空权限）", () => {
  const tag: PermissionTagSnapshot = {
    tag: {
      name: "project-lead:1",
      permissions: [],
      template: { permissions: [PERMISSIONS.PROJECT_MANAGE] },
    },
  };
  const permissions = computePermissionsFromSnapshot({ role: "MEMBER", status: "ACTIVE", tags: [tag] });
  assert.equal(permissions.has(PERMISSIONS.PROJECT_MANAGE), false);
});

test("当 Tag 实例权限为 null 时，应回退使用模板上定义的权限", () => {
  const tag: PermissionTagSnapshot = {
    tag: {
      name: "project-member:1",
      permissions: null,
      template: { permissions: [PERMISSIONS.PROJECT_NODE_CREATE] },
    },
  };
  const permissions = computePermissionsFromSnapshot({ role: "MEMBER", status: "ACTIVE", tags: [tag] });
  assert.equal(permissions.has(PERMISSIONS.PROJECT_NODE_CREATE), true);
});

test("项目范围（PROJECT）的 Tag 权限不得泄露进全局权限集合", () => {
  const tag: PermissionTagSnapshot = {
    projectId: "project-a",
    tag: {
      name: "project-member:project-a",
      permissions: null,
      template: { permissions: [PERMISSIONS.PROJECT_NODE_CREATE] },
    },
  };
  const permissions = computePermissionsFromSnapshot({ role: "MEMBER", status: "ACTIVE", tags: [tag] });
  assert.equal(permissions.has(PERMISSIONS.PROJECT_NODE_CREATE), false);
});

test("项目范围的权限只应在匹配的项目内生效，对其他项目无效", () => {
  const tag: PermissionTagSnapshot = {
    projectId: "project-a",
    tag: {
      name: "project-lead:project-a",
      permissions: null,
      template: { permissions: [PERMISSIONS.PROJECT_MANAGE, PERMISSIONS.PROJECT_NODE_CREATE] },
    },
  };
  const user = { role: "MEMBER" as const, status: "ACTIVE" as const, tags: [tag] };
  assert.equal(computeProjectPermissionsFromSnapshot(user, "project-a").has(PERMISSIONS.PROJECT_MANAGE), true);
  assert.equal(computeProjectPermissionsFromSnapshot(user, "project-b").has(PERMISSIONS.PROJECT_MANAGE), false);
});

test("已撤销或已过期的 Tag 应视为无效，不再授予任何权限", () => {
  const now = new Date("2026-06-22T00:00:00.000Z");
  assert.equal(isEffectiveTag({ tag: { name: "advisor", permissions: [] }, revokedAt: now }, now), false);
  assert.equal(
    isEffectiveTag({ tag: { name: "advisor", permissions: [] }, expiresAt: "2026-06-21T23:59:59.000Z" }, now),
    false,
  );
});

test("权限列表归一化必须丢弃未知权限字符串", () => {
  assert.deepEqual(normalizePermissionList([PERMISSIONS.POST_READ, "unknown.permission", 123]), [PERMISSIONS.POST_READ]);
});

test("权限说明应覆盖已知权限并返回中文文案", () => {
  assert.equal(describePermission(PERMISSIONS.POST_CREATE), "发布帖子");
  assert.equal(describePermission(PERMISSIONS.PROJECT_MEMBER_MANAGE), "管理项目成员");
});
