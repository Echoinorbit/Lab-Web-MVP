import assert from "node:assert/strict";
import test from "node:test";

import { splitCommaList } from "../src/shared/lib/utils";

test("逗号列表应支持英文逗号、中文全角逗号和混用", () => {
  assert.deepEqual(splitCommaList("明日方舟,终末地,战锤40K"), ["明日方舟", "终末地", "战锤40K"]);
  assert.deepEqual(splitCommaList("明日方舟，终末地，战锤40K"), ["明日方舟", "终末地", "战锤40K"]);
  assert.deepEqual(splitCommaList("明日方舟, 终末地， 战锤40K"), ["明日方舟", "终末地", "战锤40K"]);
});

test("逗号列表应过滤首尾空段和多余空白", () => {
  assert.deepEqual(splitCommaList("， A ,, B ， "), ["A", "B"]);
  assert.deepEqual(splitCommaList("   "), []);
});
