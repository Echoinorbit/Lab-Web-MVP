import assert from "node:assert/strict";
import test from "node:test";

import { securityHeaders } from "../next.config";
import { validatePasswordPolicy } from "../src/shared/lib/security";

test("密码策略应拒绝过短或与身份信息相关联的密码", () => {
  assert.equal(validatePasswordPolicy("Short1!", ["alice"]).ok, false);
  assert.equal(validatePasswordPolicy("AliceStrong123!", ["alice"]).ok, false);
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
