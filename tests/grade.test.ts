import assert from "node:assert/strict";
import test from "node:test";

import {
  computeGrade,
  defaultEnrollmentDate,
  enrollmentDateForGrade,
  formatComputedGrade,
  isGraduatedByGrade,
  resolveGradeTrackFromTagNames,
  yearsSinceEnrollment,
} from "../src/shared/lib/grade";

test("默认入学锚点应落在创建上海年份的 9 月 1 日零点", () => {
  const anchor = defaultEnrollmentDate(new Date("2026-01-15T04:00:00.000Z"));
  assert.equal(anchor.toISOString(), "2026-08-31T16:00:00.000Z");
});

test("年级应按上海时间 9 月 1 日学年边界递增", () => {
  const enrollment = new Date("2024-08-31T16:00:00.000Z");
  assert.equal(yearsSinceEnrollment(enrollment, new Date("2025-08-31T15:59:59.000Z")), 0);
  assert.equal(yearsSinceEnrollment(enrollment, new Date("2025-08-31T16:00:00.000Z")), 1);
  assert.equal(computeGrade("master", enrollment, new Date("2025-08-31T16:00:00.000Z")), "研1");
});

test("硕士第 4 个完整学年起、博士第 5 个完整学年起应视为已毕业", () => {
  assert.equal(computeGrade("master", new Date("2021-08-31T16:00:00.000Z"), new Date("2025-08-31T16:00:00.000Z")), null);
  assert.equal(isGraduatedByGrade("master", new Date("2021-08-31T16:00:00.000Z"), new Date("2025-08-31T16:00:00.000Z")), true);
  assert.equal(computeGrade("phd", new Date("2020-08-31T16:00:00.000Z"), new Date("2025-08-31T16:00:00.000Z")), null);
  assert.equal(computeGrade("phd", new Date("2021-08-31T16:00:00.000Z"), new Date("2025-08-31T16:00:00.000Z")), "博5");
});

test("管理员设置年级时反推锚点应与计算结果往返一致", () => {
  const now = new Date("2026-10-01T00:00:00.000Z");
  for (const label of ["研0", "研1", "研2", "研3"]) {
    const anchor = enrollmentDateForGrade("master", label, now);
    assert.equal(computeGrade("master", anchor, now), label);
  }
  for (const label of ["博1", "博2", "博3", "博4", "博5"]) {
    const anchor = enrollmentDateForGrade("phd", label, now);
    assert.equal(computeGrade("phd", anchor, now), label);
  }
  assert.throws(() => enrollmentDateForGrade("master", "博2", now), /不匹配/);
});

test("培养类型应由有效 Tag 决定且博士优先", () => {
  assert.equal(resolveGradeTrackFromTagNames(["grad-master"]), "master");
  assert.equal(resolveGradeTrackFromTagNames(["grad-master", "grad-phd"]), "phd");
  assert.equal(resolveGradeTrackFromTagNames(["advisor"]), null);
});

test("展示年级应优先使用可计算值，缺少锚点或培养类型时才回退快照", () => {
  const now = new Date("2025-08-31T16:00:00.000Z");
  assert.equal(formatComputedGrade({ grade: "研0", enrollmentDate: "2024-08-31T16:00:00.000Z", tagNames: ["grad-master"] }, now), "研1");
  assert.equal(formatComputedGrade({ grade: "研0", enrollmentDate: null, tagNames: ["grad-master"] }, now), "研0");
  assert.equal(formatComputedGrade({ grade: null, enrollmentDate: null, tagNames: [] }, now), "—");
});
