import assert from "node:assert/strict";
import test from "node:test";

import { buildNavigationAccess } from "../src/shared/lib/navigation-access";
import { PERMISSIONS, type Permission } from "../src/shared/lib/permissions";

test("普通成员侧栏应保留公共入口并按权限隐藏进度/admin 入口", () => {
  const access = buildNavigationAccess(new Set<Permission>());

  assert.equal(access.home, true);
  assert.equal(access.announcements, true);
  assert.equal(access.posts, true);
  assert.equal(access.projects, true);
  assert.equal(access.progress, false);
  assert.equal(access.notifications, true);
  assert.equal(access["admin-users"], false);
  assert.equal(access["admin-tags"], false);
  assert.equal(access["admin-audit"], false);
  assert.equal(access["admin-settings"], false);
});

test("拥有进度填写或全量读取权限时应显示进度入口", () => {
  assert.equal(buildNavigationAccess(new Set<Permission>([PERMISSIONS.PROGRESS_REPORT_WRITE])).progress, true);
  assert.equal(buildNavigationAccess(new Set<Permission>([PERMISSIONS.PROGRESS_REPORT_SUBMIT])).progress, true);
  assert.equal(buildNavigationAccess(new Set<Permission>([PERMISSIONS.PROGRESS_REPORT_READ_ALL])).progress, true);
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
