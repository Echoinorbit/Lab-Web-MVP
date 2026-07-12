import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isCanonicalProjectAdvisorEligible,
  isCanonicalProjectLeaderEligible,
  shouldProjectRequireLeaderReassignment,
} from "../src/features/projects/lib/project-responsibility";

const eligibleStudent = {
  role: "MEMBER" as const,
  status: "ACTIVE" as const,
  studyDegree: "MASTER" as const,
  identityNeedsReview: false,
  advisorId: "advisor-1",
};

test("canonical 项目导师必须是身份已确认的在用导师成员", () => {
  const advisor = {
    role: "MEMBER" as const,
    status: "ACTIVE" as const,
    studyDegree: "MENTOR" as const,
    identityNeedsReview: false,
  };
  assert.equal(isCanonicalProjectAdvisorEligible(advisor), true);
  assert.equal(isCanonicalProjectAdvisorEligible({ ...advisor, role: "ADMIN" }), false);
  assert.equal(isCanonicalProjectAdvisorEligible({ ...advisor, status: "SUSPENDED" }), false);
  assert.equal(isCanonicalProjectAdvisorEligible({ ...advisor, studyDegree: "MASTER" }), false);
  assert.equal(isCanonicalProjectAdvisorEligible({ ...advisor, identityNeedsReview: true }), false);
  assert.equal(isCanonicalProjectAdvisorEligible(null), false);
});

test("canonical 项目负责人必须是负责导师的直属在读硕博成员", () => {
  assert.equal(isCanonicalProjectLeaderEligible(eligibleStudent, "advisor-1"), true);
  assert.equal(isCanonicalProjectLeaderEligible({ ...eligibleStudent, advisorId: "advisor-2" }, "advisor-1"), false);
  assert.equal(isCanonicalProjectLeaderEligible({ ...eligibleStudent, role: "ADMIN" }, "advisor-1"), false);
  assert.equal(isCanonicalProjectLeaderEligible({ ...eligibleStudent, status: "SUSPENDED" }, "advisor-1"), false);
  assert.equal(isCanonicalProjectLeaderEligible({ ...eligibleStudent, status: "GRADUATED" }, "advisor-1"), false);
  assert.equal(isCanonicalProjectLeaderEligible({ ...eligibleStudent, studyDegree: "MENTOR" }, "advisor-1"), false);
  assert.equal(isCanonicalProjectLeaderEligible({ ...eligibleStudent, identityNeedsReview: true }, "advisor-1"), false);
  assert.equal(isCanonicalProjectLeaderEligible(eligibleStudent, null), false);
  assert.equal(isCanonicalProjectLeaderEligible(null, "advisor-1"), false);
});

test("只有未删除、未归档、未完成的项目在负责人失效后进入待分配", () => {
  const active = { deletedAt: null, archivedAt: null, status: "IN_PROGRESS" };
  assert.equal(shouldProjectRequireLeaderReassignment(active), true);
  assert.equal(shouldProjectRequireLeaderReassignment({ ...active, deletedAt: new Date() }), false);
  assert.equal(shouldProjectRequireLeaderReassignment({ ...active, archivedAt: new Date(), status: "ARCHIVED" }), false);
  assert.equal(shouldProjectRequireLeaderReassignment({ ...active, status: "ARCHIVED" }), false);
  assert.equal(shouldProjectRequireLeaderReassignment({ ...active, status: "COMPLETED" }), false);
});

test("用户生命周期与导师关系变更统一经过项目责任协调器", () => {
  for (const file of [
    "src/features/admin/actions/update-user-advisor.ts",
    "src/features/admin/actions/update-user-role.ts",
    "src/features/admin/actions/update-user-status.ts",
    "src/features/admin/lib/study-identity-service.ts",
    "src/features/admin/lib/user-lifecycle.ts",
    "src/features/admin/lib/delete-user-account.ts",
  ]) {
    assert.match(
      readFileSync(file, "utf8"),
      /reconcileCanonicalProjectLeadershipForUser/,
      file,
    );
  }

  for (const file of [
    "src/features/admin/actions/update-user-role.ts",
    "src/features/admin/actions/update-user-status.ts",
    "src/features/admin/lib/study-identity-service.ts",
    "src/features/admin/lib/delete-user-account.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /assertNoActiveProjectAdvisorResponsibilities/, file);
    assert.match(
      source,
      /reconcileCanonicalProjectLeadershipForAdvisor|releaseFormerMentorResponsibilities/,
      file,
    );
  }

  const identityServiceSource = readFileSync("src/features/admin/lib/study-identity-service.ts", "utf8");
  assert.match(identityServiceSource, /releaseFormerMentorResponsibilities/);
  assert.match(identityServiceSource, /reconcileCanonicalProjectLeadershipForAdvisor/);
});
