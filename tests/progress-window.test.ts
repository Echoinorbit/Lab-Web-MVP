import assert from "node:assert/strict";
import test from "node:test";

import {
  PROGRESS_BACKFILL_WINDOW_HOURS,
  canWriteProgressReport,
  getProgressBackfillExpiresAt,
  getShanghaiDateParts,
  getShanghaiDayWindowStart,
  isProgressReportWindowOpen,
} from "../src/shared/lib/date";
import {
  BACKFILL_WINDOW_USED_MESSAGE,
  SAVE_REPORT_CONSUMES_BACKFILL_WINDOW,
  assertBackfillWindowConsumed,
  buildBackfillWindowConsumeWhere,
} from "../src/features/progress/lib/backfill";
import { buildProgressReportWriteLockKey } from "../src/features/progress/lib/report-write";

test("上海年月日应按 Asia/Shanghai 时区推算，而非本地或 UTC 日期", () => {
  assert.deepEqual(getShanghaiDateParts(new Date("2026-06-24T16:30:00.000Z")), {
    year: 2026,
    month: 6,
    day: 25,
  });
});

test("进度报告填报窗口应在上海时间 25 日开放，并于 27 日之后关闭", () => {
  assert.equal(isProgressReportWindowOpen(new Date("2026-06-24T15:59:00.000Z")), false);
  assert.equal(isProgressReportWindowOpen(new Date("2026-06-24T16:00:00.000Z")), true);
  assert.equal(isProgressReportWindowOpen(new Date("2026-06-27T15:59:00.000Z")), true);
  assert.equal(isProgressReportWindowOpen(new Date("2026-06-27T16:00:00.000Z")), false);
});

test("进度报告只能填写当前上海月份，不能填写过往月份", () => {
  const date = new Date("2026-06-25T04:00:00.000Z");
  assert.equal(canWriteProgressReport(2026, 6, date), true);
  assert.equal(canWriteProgressReport(2026, 5, date), false);
});

test("上海自然日窗口的起点应保持稳定，以支撑持久化的每日限流计数", () => {
  assert.equal(getShanghaiDayWindowStart(new Date("2026-06-25T04:00:00.000Z")).toISOString(), "2026-06-24T16:00:00.000Z");
});

test("进度补填的过期时间应由服务端推算为固定的短时窗口（24 小时）", () => {
  const openedAt = new Date("2026-06-25T04:00:00.000Z");
  const expiresAt = getProgressBackfillExpiresAt(openedAt);
  assert.equal(PROGRESS_BACKFILL_WINDOW_HOURS, 24);
  assert.equal(expiresAt.toISOString(), "2026-06-26T04:00:00.000Z");
});

test("提交补填应使用条件更新消费未使用且未过期的窗口", () => {
  const now = new Date("2026-06-25T04:00:00.000Z");
  assert.deepEqual(buildBackfillWindowConsumeWhere("bw1", now), {
    id: "bw1",
    usedAt: null,
    expiresAt: { gt: now },
  });
  assert.doesNotThrow(() => assertBackfillWindowConsumed(1));
  assert.throws(() => assertBackfillWindowConsumed(0), new RegExp(BACKFILL_WINDOW_USED_MESSAGE));
});

test("保存草稿只受补填窗口门控，不消费一次性补填窗口", () => {
  assert.equal(SAVE_REPORT_CONSUMES_BACKFILL_WINDOW, false);
});

test("进度报告写入锁应按用户和年月隔离", () => {
  assert.equal(buildProgressReportWriteLockKey("user-1", 2026, 6), "progress-report:user-1:2026:6");
  assert.notEqual(
    buildProgressReportWriteLockKey("user-1", 2026, 6),
    buildProgressReportWriteLockKey("user-1", 2026, 7),
  );
  assert.notEqual(
    buildProgressReportWriteLockKey("user-1", 2026, 6),
    buildProgressReportWriteLockKey("user-2", 2026, 6),
  );
});
