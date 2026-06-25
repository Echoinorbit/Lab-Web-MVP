import assert from "node:assert/strict";
import test from "node:test";

import { buildNavigationAccess } from "../src/shared/lib/navigation-access";
import { PERMISSIONS, type Permission } from "../src/shared/lib/permissions";

test("普通成员侧栏应保留公共入口并禁用 admin 入口", () => {
  const access = buildNavigationAccess(new Set<Permission>());

  assert.equal(access.home, true);
  assert.equal(access.announcements, true);
  assert.equal(access.posts, true);
  assert.equal(access.projects, true);
  assert.equal(access.progress, true);
  assert.equal(access.notifications, true);
  assert.equal(access["admin-users"], false);
  assert.equal(access["admin-tags"], false);
  assert.equal(access["admin-audit"], false);
  assert.equal(access["admin-settings"], false);
});

test("管理员权限应分别启用对应 admin 导航项", () => {
  const access = buildNavigationAccess(
    new Set<Permission>([
      PERMISSIONS.ADMIN_USER_MANAGE,
      PERMISSIONS.ADMIN_TAG_MANAGE,
      PERMISSIONS.ADMIN_AUDIT_VIEW,
      PERMISSIONS.ADMIN_SETTINGS,
    ]),
  );

  assert.equal(access["admin-users"], true);
  assert.equal(access["admin-tags"], true);
  assert.equal(access["admin-audit"], true);
  assert.equal(access["admin-settings"], true);
});
