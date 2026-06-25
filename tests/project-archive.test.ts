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
} from "../src/features/projects/lib/archive";
import { isProjectLeadTagName } from "../src/features/projects/lib/tag-grants";
import {
  PROJECT_ARCHIVED_WRITE_MESSAGE,
  assertProjectWritableStatus,
} from "../src/features/projects/lib/writable";

test("项目归档只允许 IN_PROGRESS 状态", () => {
  assert.doesNotThrow(() => assertProjectCanArchiveStatus("IN_PROGRESS"));
  assert.throws(() => assertProjectCanArchiveStatus("PLANNING"), /进行中/);
  assert.throws(() => assertProjectCanArchiveStatus("ARCHIVED"), /进行中/);
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

test("项目组长身份必须匹配 project-lead scoped tag", () => {
  assert.equal(isProjectLeadTagName("project-lead:project-1", "project-1"), true);
  assert.equal(isProjectLeadTagName("project-member:project-1", "project-1"), false);
  assert.equal(isProjectLeadTagName("project-lead:project-2", "project-1"), false);
});

test("归档倒计时展示应按剩余时间分段", () => {
  assert.equal(formatProjectArchiveRemaining(2 * 86400 * 1000 + 3 * 3600 * 1000), "2天3小时");
  assert.equal(formatProjectArchiveRemaining(2 * 3600 * 1000 + 5 * 60 * 1000), "2小时5分");
  assert.equal(formatProjectArchiveRemaining(65 * 1000), "1分5秒");
  assert.equal(formatProjectArchiveRemaining(0), "0秒");
});
