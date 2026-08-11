import assert from "node:assert/strict";
import test from "node:test";

import nextConfig, { securityHeaders } from "../next.config";
import { isPublicRoutePrefilterPath } from "../src/shared/lib/route-prefilter";
import { validatePasswordPolicy } from "../src/shared/lib/security";

test("密码策略应拒绝过短或与身份信息相关联的密码", () => {
  const short = validatePasswordPolicy("Short1!", ["alice"]);
  assert.equal(short.ok, false);
  assert.equal(short.errors.includes("密码至少需要 10 位。"), true);
  const identity = validatePasswordPolicy("AliceStrong123!", ["alice"]);
  assert.equal(identity.ok, false);
  assert.equal(identity.errors.includes("密码不能包含用户名或学号。"), true);
});

test("密码策略应接受足够复杂且与身份信息无关的密码", () => {
  assert.equal(validatePasswordPolicy("Research#2026", ["alice", "2024001"]).ok, true);
});

test("Next.js 全局安全响应头应包含基础硬化策略", () => {
  const headers = new Map(securityHeaders.map((header) => [header.key, header.value]));
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(headers.get("Strict-Transport-Security") ?? "", /max-age=31536000/);
  assert.match(headers.get("Content-Security-Policy-Report-Only") ?? "", /frame-ancestors 'none'/);
});

test("首页不再重写到 Endfield 视觉参考页", () => {
  assert.equal(nextConfig.rewrites, undefined);
});

test("路由预筛选只放行公开入口、认证端点与受控静态资源", () => {
  assert.equal(isPublicRoutePrefilterPath("/"), true);
  assert.equal(isPublicRoutePrefilterPath("/login"), true);
  assert.equal(isPublicRoutePrefilterPath("/api/auth/csrf"), true);
  assert.equal(isPublicRoutePrefilterPath("/avatar/default.png"), true);
  assert.equal(isPublicRoutePrefilterPath("/uploads/avatars/example.png"), true);
  assert.equal(isPublicRoutePrefilterPath("/brand-mark.jpg"), true);
  assert.equal(isPublicRoutePrefilterPath("/_endfield"), true);
  assert.equal(isPublicRoutePrefilterPath("/mostar/index.html"), false);
  assert.equal(isPublicRoutePrefilterPath("/dashboard"), false);
  assert.equal(isPublicRoutePrefilterPath("/login-impersonation"), false);
  assert.equal(isPublicRoutePrefilterPath("/admin/users"), false);
});
