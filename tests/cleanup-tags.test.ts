import assert from "node:assert/strict";
import test from "node:test";

import { isJunkTag } from "../scripts/cleanup-tags";

test("Tag 清理脚本只应匹配已知 verify 测试垃圾 Tag，不应误删普通自定义 Tag", () => {
  assert.equal(
    isJunkTag({
      name: "advisor-action-verify-advisor-action-mqq9yupt-create-only",
      displayName: "advisor-action-verify-advisor-action-mqq9yupt Create Only",
      isSystem: false,
    }),
    true,
  );
  assert.equal(
    isJunkTag({
      name: "advisor-verify-advisor-mqq94rq3-target",
      displayName: "advisor-verify-advisor-mqq94rq3 Target",
      isSystem: false,
    }),
    true,
  );
  assert.equal(isJunkTag({ name: "lab-safety", displayName: "实验室安全", isSystem: false }), false);
  assert.equal(isJunkTag({ name: "project-lead:project-1", displayName: "项目组长", isSystem: false }), false);
  assert.equal(isJunkTag({ name: "project-member:project-1", displayName: "项目成员", isSystem: false }), false);
  assert.equal(isJunkTag({ name: "advisor-verify-advisor-mqq94rq3-target", displayName: "目标", isSystem: true }), false);
});
