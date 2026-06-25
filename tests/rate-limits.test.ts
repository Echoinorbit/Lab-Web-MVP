import assert from "node:assert/strict";
import test from "node:test";

import { formatPostQuotaNotice, formatPostRateLimitExceeded } from "../src/features/posts/lib/rate-limit-copy";
import { RateLimitExceededError, resolveRateLimitResult, selectRateLimit } from "../src/shared/lib/rate-limits";

test("拥有导师 Tag 的用户发帖应直接判定为不限量", () => {
  assert.deepEqual(selectRateLimit("post.create", ["grad-master", "advisor"]), { kind: "unlimited" });
});

test("当用户同时拥有多个学生 Tag 时，应取其中最高的有限限额", () => {
  assert.deepEqual(selectRateLimit("post.create", ["grad-master", "grad-phd"]), { kind: "limited", max: 10 });
});

test("没有相应资格 Tag 的用户，对受限操作应被拒绝", () => {
  assert.deepEqual(selectRateLimit("announcement.create", ["grad-master"]), { kind: "denied" });
});

test("拥有发帖权限但没有专属配额 Tag 的用户应使用基础发帖配额", () => {
  assert.deepEqual(selectRateLimit("post.create", ["custom-author"]), { kind: "limited", max: 5 });
});

test("超限结果应保留上限与剩余次数，供中文提示使用", () => {
  const result = resolveRateLimitResult({ kind: "limited", max: 5 }, 6);
  assert.deepEqual(result, { kind: "limited", allowed: false, remaining: 0, max: 5 });
  assert.equal(formatPostRateLimitExceeded(result), "今天的发帖次数已达上限（5 篇/天），请明天再试。");
  assert.deepEqual(new RateLimitExceededError(result).result, result);
});

test("发帖额度提示应展示不限量或剩余/上限", () => {
  assert.equal(
    formatPostQuotaNotice(resolveRateLimitResult({ kind: "unlimited" }, 0)),
    "今日剩余可发：不限量",
  );
  assert.equal(
    formatPostQuotaNotice(resolveRateLimitResult({ kind: "limited", max: 10 }, 3)),
    "今日剩余可发：7/10 篇",
  );
});
