import assert from "node:assert/strict";
import test from "node:test";

import {
  IP_FAILURE_LIMIT_PER_MINUTE,
  LOCK_MINUTES,
  isIpLoginFailureRateLimited,
  parseTrustedProxyHops,
  resolveFailedLoginUpdate,
  selectClientIpFromHeaders,
} from "../src/shared/lib/auth";

test("登录锁定时长应为 3 分钟，且每分钟 IP 失败次数上限应为正数", () => {
  assert.equal(LOCK_MINUTES, 3);
  assert.equal(IP_FAILURE_LIMIT_PER_MINUTE > 0, true);
});

test("未配置可信代理时应忽略可伪造的客户端 IP 头", () => {
  assert.equal(
    selectClientIpFromHeaders({
      xForwardedFor: "203.0.113.1",
      xRealIp: "203.0.113.2",
      cfConnectingIp: "203.0.113.3",
    }),
    "unknown",
  );
  assert.equal(parseTrustedProxyHops(undefined), 0);
  assert.equal(parseTrustedProxyHops("0"), 0);
  assert.equal(parseTrustedProxyHops("not-a-number"), 0);
});

test("可信代理跳数应选择可信代理追加的最近客户端候选", () => {
  assert.equal(selectClientIpFromHeaders({ xForwardedFor: "client" }, 1), "unknown");
  assert.equal(selectClientIpFromHeaders({ xForwardedFor: "spoofed, actual-client" }, 1), "actual-client");
  assert.equal(
    selectClientIpFromHeaders({ xForwardedFor: "spoofed, actual-client, trusted-edge" }, 2),
    "actual-client",
  );
  assert.equal(selectClientIpFromHeaders({ xForwardedFor: "" }, 1), "unknown");
});

test("IP 登录失败限流应在原子预留超过上限时触发", () => {
  assert.equal(isIpLoginFailureRateLimited(IP_FAILURE_LIMIT_PER_MINUTE), false);
  assert.equal(isIpLoginFailureRateLimited(IP_FAILURE_LIMIT_PER_MINUTE + 1), true);
});

test("过期登录锁定应重置计数后再记录失败，达到阈值时吊销会话", () => {
  const now = new Date("2026-06-25T08:00:00.000Z");
  assert.deepEqual(
    resolveFailedLoginUpdate({ loginAttempts: 5, lockedUntil: new Date("2026-06-25T07:59:00.000Z") }, now),
    { loginAttempts: 1, lockedUntil: null, revokeSessions: false },
  );
  assert.deepEqual(resolveFailedLoginUpdate({ loginAttempts: 2, lockedUntil: null }, now), {
    loginAttempts: 3,
    lockedUntil: null,
    revokeSessions: false,
  });

  const locked = resolveFailedLoginUpdate({ loginAttempts: 4, lockedUntil: null }, now);
  assert.equal(locked.loginAttempts, 5);
  assert.equal(locked.lockedUntil?.toISOString(), "2026-06-25T08:03:00.000Z");
  assert.equal(locked.revokeSessions, true);

  const activeLock = new Date("2026-06-25T08:01:00.000Z");
  assert.deepEqual(resolveFailedLoginUpdate({ loginAttempts: 5, lockedUntil: activeLock }, now), {
    loginAttempts: 5,
    lockedUntil: activeLock,
    revokeSessions: false,
  });
});
