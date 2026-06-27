import assert from "node:assert/strict";
import test from "node:test";

import { formatShanghaiDate, formatShanghaiDateTime } from "../src/shared/lib/date";

test("北京时间格式化应跨越 UTC 日界线", () => {
  const instant = new Date("2026-06-24T16:05:09.000Z");
  assert.equal(formatShanghaiDate(instant), "2026-06-25");
  assert.equal(formatShanghaiDateTime(instant), "2026-06-25 00:05");
});

test("北京时间格式化接受 ISO 字符串并保持年界线正确", () => {
  assert.equal(formatShanghaiDate("2026-12-31T16:00:00.000Z"), "2027-01-01");
  assert.equal(formatShanghaiDateTime("2026-12-31T15:59:00.000Z"), "2026-12-31 23:59");
});
