import assert from "node:assert/strict";
import test from "node:test";

import { FORBIDDEN_ROUTE, isPermissionDeniedError } from "../src/shared/lib/access-denied";
import { PERMISSIONS, PermissionDeniedError } from "../src/shared/lib/permissions";

test("页面级权限失败应使用固定的 403 过场路由", () => {
  assert.equal(FORBIDDEN_ROUTE, "/403");
});

test("权限错误识别只匹配 PermissionDeniedError", () => {
  assert.equal(isPermissionDeniedError(new PermissionDeniedError(PERMISSIONS.ADMIN_DASHBOARD)), true);
  assert.equal(isPermissionDeniedError(new Error("other")), false);
  assert.equal(isPermissionDeniedError(null), false);
});
