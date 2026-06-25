import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_SUBMITTED_REPORT_EDITS,
  SUBMITTED_REPORT_EDIT_LIMIT_MESSAGE,
  assertSubmittedReportEditAllowed,
  remainingSubmittedReportEdits,
  shouldIncrementSubmittedReportEditCount,
} from "../src/features/progress/lib/edit-count";

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
