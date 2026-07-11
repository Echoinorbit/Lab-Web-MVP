import assert from "node:assert/strict";
import test from "node:test";

import {
  PROJECT_UNARCHIVE_COOLDOWN_HOURS,
  assertProjectCanArchiveStatus,
  assertProjectCanUnarchive,
  canUnarchiveProjectAt,
  formatProjectArchiveRemaining,
  getProjectUnarchiveAvailableAt,
  getProjectUnarchiveRemainingMs,
  resolveProjectArchiveAccess,
} from "../src/features/projects/lib/archive";
import {
  PROJECT_ARCHIVED_WRITE_MESSAGE,
  assertProjectWritableStatus,
} from "../src/features/projects/lib/writable";
import { PERMISSIONS } from "../src/shared/lib/permissions";

test("项目归档允许 PLANNING 与 IN_PROGRESS，拒绝终态", () => {
  assert.doesNotThrow(() => assertProjectCanArchiveStatus("PLANNING"));
  assert.doesNotThrow(() => assertProjectCanArchiveStatus("IN_PROGRESS"));
  assert.throws(() => assertProjectCanArchiveStatus("COMPLETED"), /规划中或进行中/);
  assert.throws(() => assertProjectCanArchiveStatus("ARCHIVED"), /规划中或进行中/);
});

test("项目归档只信任 canonical leaderId 或管理员治理权限", () => {
  const none = new Set<never>();
  assert.deepEqual(
    resolveProjectArchiveAccess({ actorId: "lead", actorCanLead: true, leaderId: "lead", globalPermissions: none }),
    { allowed: true, scope: "leader" },
  );
  assert.deepEqual(
    resolveProjectArchiveAccess({
      actorId: "admin",
      actorCanLead: false,
      leaderId: "lead",
      globalPermissions: new Set([PERMISSIONS.PROJECT_ARCHIVE_ANY]),
    }),
    { allowed: true, scope: "admin" },
  );
  assert.deepEqual(
    resolveProjectArchiveAccess({ actorId: "member", actorCanLead: true, leaderId: "lead", globalPermissions: none }),
    { allowed: false },
  );
  assert.deepEqual(
    resolveProjectArchiveAccess({ actorId: "lead", actorCanLead: false, leaderId: "lead", globalPermissions: none }),
    { allowed: false },
  );
});

test("项目反激活冷却期为 168 小时，边界到点才允许", () => {
  const archivedAt = new Date("2026-06-01T00:00:00.000Z");
  assert.equal(PROJECT_UNARCHIVE_COOLDOWN_HOURS, 168);
  assert.equal(getProjectUnarchiveAvailableAt(archivedAt).toISOString(), "2026-06-08T00:00:00.000Z");
  assert.equal(canUnarchiveProjectAt(archivedAt, new Date("2026-06-07T23:59:59.000Z")), false);
  assert.equal(canUnarchiveProjectAt(archivedAt, new Date("2026-06-08T00:00:00.000Z")), true);
  assert.equal(getProjectUnarchiveRemainingMs(archivedAt, new Date("2026-06-08T00:00:00.000Z")), 0);
});

test("项目反激活状态机应拒绝非归档或冷却未满", () => {
  const archivedAt = new Date("2026-06-01T00:00:00.000Z");
  assert.throws(() => assertProjectCanUnarchive("IN_PROGRESS", null), /已归档/);
  assert.throws(() => assertProjectCanUnarchive("ARCHIVED", archivedAt, new Date("2026-06-07T00:00:00.000Z")), /7 天/);
  assert.doesNotThrow(() => assertProjectCanUnarchive("ARCHIVED", archivedAt, new Date("2026-06-08T00:00:00.000Z")));
});

test("归档项目应拒绝写操作", () => {
  assert.doesNotThrow(() => assertProjectWritableStatus("IN_PROGRESS"));
  assert.throws(() => assertProjectWritableStatus("ARCHIVED"), { message: PROJECT_ARCHIVED_WRITE_MESSAGE });
});

test("归档倒计时展示应按剩余时间分段", () => {
  assert.equal(formatProjectArchiveRemaining(2 * 86400 * 1000 + 3 * 3600 * 1000), "2天3小时");
  assert.equal(formatProjectArchiveRemaining(2 * 3600 * 1000 + 5 * 60 * 1000), "2小时5分");
  assert.equal(formatProjectArchiveRemaining(65 * 1000), "1分5秒");
  assert.equal(formatProjectArchiveRemaining(0), "0秒");
});
