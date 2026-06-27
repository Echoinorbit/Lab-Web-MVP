import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SUBMITTED_REPORT_EDITS,
  SUBMITTED_REPORT_EDIT_LIMIT_MESSAGE,
  assertSubmittedReportEditAllowed,
  remainingSubmittedReportEdits,
  shouldIncrementSubmittedReportEditCount,
} from "../src/features/progress/lib/edit-count";
import { describeProgressWriteMode } from "../src/features/progress/lib/report-form";

test("已提交进度报告最多允许修改 3 次", () => {
  assert.equal(MAX_SUBMITTED_REPORT_EDITS, 3);
  assert.equal(remainingSubmittedReportEdits(0), 3);
  assert.equal(remainingSubmittedReportEdits(2), 1);
  assert.equal(remainingSubmittedReportEdits(3), 0);
  assert.equal(remainingSubmittedReportEdits(4), 0);
});

test("已用完修改次数时应抛出固定中文错误", () => {
  assert.doesNotThrow(() => assertSubmittedReportEditAllowed(2));
  assert.throws(() => assertSubmittedReportEditAllowed(3), {
    message: SUBMITTED_REPORT_EDIT_LIMIT_MESSAGE,
  });
});

test("只有已提交报告保存修改时才递增 editCount", () => {
  assert.equal(shouldIncrementSubmittedReportEditCount("SUBMITTED"), true);
  assert.equal(shouldIncrementSubmittedReportEditCount("DRAFT"), false);
  assert.equal(shouldIncrementSubmittedReportEditCount(null), false);
  assert.equal(shouldIncrementSubmittedReportEditCount(undefined), false);
});

test("进度表单应明确区分常规窗口、补填窗口和只读月份", () => {
  assert.match(describeProgressWriteMode("regular"), /25–27 日/);
  assert.match(describeProgressWriteMode("backfill"), /24 小时补填窗口/);
  assert.match(describeProgressWriteMode("closed-current"), /当前为只读/);
  assert.match(describeProgressWriteMode("closed-history"), /联系管理员/);
});
