import assert from "node:assert/strict";
import test from "node:test";

import { resolveProgressPeriod } from "../src/features/progress/lib/period";

test("进度页默认月份应取上海当前月而非硬编码年月", () => {
  const period = resolveProgressPeriod({}, new Date("2027-01-31T16:30:00.000Z"));
  assert.equal(period.year, 2027);
  assert.equal(period.month, 2);
  assert.equal(period.isCurrent, true);
  assert.deepEqual(period.prev, { year: 2027, month: 1 });
});

test("进度页显式历史月份仍可浏览，并提供回到本月的目标", () => {
  const period = resolveProgressPeriod(
    { year: "2026", month: "12" },
    new Date("2027-01-31T16:30:00.000Z"),
  );
  assert.equal(period.isCurrent, false);
  assert.deepEqual(period.current, { year: 2027, month: 2 });
  assert.deepEqual(period.next, { year: 2027, month: 1 });
});

test("进度页非法年月参数应回退到上海本月", () => {
  const period = resolveProgressPeriod(
    { year: "oops", month: "13" },
    new Date("2026-06-24T16:30:00.000Z"),
  );
  assert.deepEqual({ year: period.year, month: period.month }, { year: 2026, month: 6 });
});
