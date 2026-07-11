import assert from "node:assert/strict";
import test from "node:test";

import {
  GRADUATION_GRACE_HOURS,
  getScheduledDeletionAt,
  isResolvedStudentIdentity,
} from "../src/features/admin/lib/user-lifecycle";
import { isSessionCurrent } from "../src/shared/lib/session";
import { resolveSessionStatus } from "../src/shared/lib/user-status";

test("会话必须同时满足账号、状态、tokenVersion 与绝对策略到期时间", () => {
  const now = new Date("2026-07-10T00:00:00.000Z");
  const validSession = { tokenVersion: 2, policyExpiresAt: "2026-07-10T01:00:00.000Z" };
  assert.equal(isSessionCurrent(validSession, { status: "ACTIVE", tokenVersion: 2 }, now), true);
  assert.equal(isSessionCurrent({ tokenVersion: 2 }, { status: "ACTIVE", tokenVersion: 2 }, now), false);
  assert.equal(isSessionCurrent(validSession, { status: "ACTIVE", tokenVersion: 3 }, now), false);
  assert.equal(isSessionCurrent(validSession, { status: "SUSPENDED", tokenVersion: 2 }, now), false);
  assert.equal(isSessionCurrent(validSession, { status: "GRADUATED", tokenVersion: 2 }, now), false);
  assert.equal(isSessionCurrent(validSession, null, now), false);
  assert.equal(
    isSessionCurrent({ tokenVersion: 2, policyExpiresAt: now }, { status: "ACTIVE", tokenVersion: 2 }, now),
    false,
  );
  assert.equal(
    isSessionCurrent({ tokenVersion: 2, policyExpiresAt: "invalid" }, { status: "ACTIVE", tokenVersion: 2 }, now),
    false,
  );
});

test("会话状态应保留已毕业语义但仍将失效会话视为不可用", () => {
  assert.equal(resolveSessionStatus("ACTIVE", true), "ACTIVE");
  assert.equal(resolveSessionStatus("ACTIVE", false), "SUSPENDED");
  assert.equal(resolveSessionStatus("SUSPENDED", false), "SUSPENDED");
  assert.equal(resolveSessionStatus("GRADUATED", false), "GRADUATED");
  assert.equal(resolveSessionStatus(null, false), "SUSPENDED");
});

test("只有身份已确认的硕博成员可进入毕业清理期", () => {
  assert.equal(
    isResolvedStudentIdentity({ role: "MEMBER", studyDegree: "MASTER", identityNeedsReview: false }),
    true,
  );
  assert.equal(isResolvedStudentIdentity({ role: "MEMBER", studyDegree: "DOCTOR", identityNeedsReview: false }), true);
  assert.equal(isResolvedStudentIdentity({ role: "MEMBER", studyDegree: "MENTOR", identityNeedsReview: false }), false);
  assert.equal(isResolvedStudentIdentity({ role: "MEMBER", studyDegree: "MASTER", identityNeedsReview: true }), false);
  assert.equal(isResolvedStudentIdentity({ role: "ADMIN", studyDegree: null, identityNeedsReview: false }), false);
});

test("毕业删除计划严格使用数据库时刻加 72 小时", () => {
  const graduatedAt = new Date("2026-07-10T00:00:00.000Z");
  assert.equal(GRADUATION_GRACE_HOURS, 72);
  assert.equal(getScheduledDeletionAt(graduatedAt).toISOString(), "2026-07-13T00:00:00.000Z");
});
