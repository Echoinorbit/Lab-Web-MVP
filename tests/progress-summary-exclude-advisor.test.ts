import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVISOR_TAG_NAME,
  hasEffectiveAdvisorTag,
  withoutEffectiveAdvisorTagWhere,
} from "../src/features/progress/lib/advisor-filter";

test("进度汇总应识别持有有效 advisor Tag 的导师账号", () => {
  const now = new Date("2026-06-25T04:00:00.000Z");

  assert.equal(
    hasEffectiveAdvisorTag({
      tags: [{ tag: { name: ADVISOR_TAG_NAME }, expiresAt: null, revokedAt: null }],
    }, now),
    true,
  );
  assert.equal(
    hasEffectiveAdvisorTag({
      tags: [{ tag: { name: ADVISOR_TAG_NAME }, expiresAt: "2026-06-25T04:00:01.000Z", revokedAt: null }],
    }, now),
    true,
  );
});

test("已撤销或过期 advisor Tag 不应把成员排除出进度统计", () => {
  const now = new Date("2026-06-25T04:00:00.000Z");

  assert.equal(
    hasEffectiveAdvisorTag({
      tags: [{ tag: { name: ADVISOR_TAG_NAME }, expiresAt: null, revokedAt: "2026-06-25T03:00:00.000Z" }],
    }, now),
    false,
  );
  assert.equal(
    hasEffectiveAdvisorTag({
      tags: [{ tag: { name: ADVISOR_TAG_NAME }, expiresAt: "2026-06-25T03:59:59.000Z", revokedAt: null }],
    }, now),
    false,
  );
  assert.equal(hasEffectiveAdvisorTag({ tags: [{ tag: { name: "grad-master" }, expiresAt: null, revokedAt: null }] }, now), false);
});

test("进度统计查询条件应排除有效 advisor Tag", () => {
  const now = new Date("2026-06-25T04:00:00.000Z");

  assert.deepEqual(withoutEffectiveAdvisorTagWhere(now), {
    NOT: {
      tags: {
        some: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          tag: { name: ADVISOR_TAG_NAME },
        },
      },
    },
  });
});
