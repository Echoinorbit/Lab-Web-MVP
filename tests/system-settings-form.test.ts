import assert from "node:assert/strict";
import test from "node:test";

import {
  parseSystemSettingsRevision,
  parseSystemSettingsTime,
} from "../src/features/admin/lib/system-settings-form";

test("系统设置时间字段只接受真实的 24 小时时刻", () => {
  assert.equal(parseSystemSettingsTime("00:00"), 0);
  assert.equal(parseSystemSettingsTime("23:59"), 1439);
  assert.equal(Number.isNaN(parseSystemSettingsTime("12:99")), true);
  assert.equal(Number.isNaN(parseSystemSettingsTime("24:00")), true);
  assert.equal(Number.isNaN(parseSystemSettingsTime("9:05")), true);
  assert.equal(Number.isNaN(parseSystemSettingsTime(null)), true);
});

test("系统设置 revision 拒绝缺失、负数、小数和非数字", () => {
  assert.equal(parseSystemSettingsRevision("0"), 0);
  assert.equal(parseSystemSettingsRevision("12"), 12);
  for (const value of [null, "", " ", "-1", "1.5", "NaN"]) {
    assert.equal(Number.isNaN(parseSystemSettingsRevision(value)), true);
  }
});
