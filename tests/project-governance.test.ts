import assert from "node:assert/strict";
import test from "node:test";

import { createActorSnapshot } from "../src/shared/lib/actor-snapshot";
import {
  assertParticipantsBelongToAdvisor,
  canEditProjectSnapshot,
  canHardDeleteProjectSnapshot,
  canRestoreProjectSnapshot,
  canSoftDeleteProjectSnapshot,
  isEligibleProjectLeaderActor,
  resolveProjectCreationContext,
} from "../src/features/projects/lib/project-governance";
import { PERMISSIONS } from "../src/shared/lib/permissions";
import { applyHardDeleteProject, type ProjectHardDeleteTransaction } from "../src/features/projects/lib/hard-delete";

test("管理员代建必须选择真实导师，且项目创建者与负责导师都归属该导师", () => {
  assert.throws(
    () => resolveProjectCreationContext({ actorId: "admin", actorRole: "ADMIN", actorIsAdvisor: false }),
    /选择负责导师/,
  );
  assert.deepEqual(
    resolveProjectCreationContext({
      actorId: "admin",
      actorRole: "ADMIN",
      actorIsAdvisor: false,
      selectedAdvisorId: "advisor-1",
    }),
    { creatorId: "advisor-1", advisorId: "advisor-1", delegated: true },
  );
});

test("导师本人建项目应锁定为自己，普通成员不能绕过项目创建身份约束", () => {
  assert.deepEqual(
    resolveProjectCreationContext({ actorId: "advisor-1", actorRole: "MEMBER", actorIsAdvisor: true }),
    { creatorId: "advisor-1", advisorId: "advisor-1", delegated: false },
  );
  assert.throws(
    () => resolveProjectCreationContext({ actorId: "member-1", actorRole: "MEMBER", actorIsAdvisor: false }),
    /仅导师或管理员/,
  );
});

test("项目组长与负责导师可编辑，学生成员和无关导师不可编辑", () => {
  const advised = { advisorId: "advisor-1", leaderId: "lead-1", deletedAt: null };
  assert.equal(canEditProjectSnapshot("lead-1", true, advised, {
    projectPermissions: new Set(),
    globalPermissions: new Set(),
  }), true);
  assert.equal(canEditProjectSnapshot("lead-1", false, advised, {
    projectPermissions: new Set(),
    globalPermissions: new Set(),
  }), false);
  assert.equal(canEditProjectSnapshot("advisor-1", false, advised, {
    projectPermissions: new Set(),
    globalPermissions: new Set([PERMISSIONS.PROJECT_UPDATE_ADVISED]),
  }), true);
  assert.equal(canEditProjectSnapshot("member-1", false, advised, { projectPermissions: new Set(), globalPermissions: new Set() }), false);
  assert.equal(canEditProjectSnapshot("advisor-2", false, advised, {
    projectPermissions: new Set(),
    globalPermissions: new Set([PERMISSIONS.PROJECT_UPDATE_ADVISED]),
  }), false);
  assert.equal(canEditProjectSnapshot("member-1", false, advised, {
    projectPermissions: new Set(),
    globalPermissions: new Set([PERMISSIONS.PROJECT_MANAGE]),
  }), false);
});

test("canonical 项目组长必须是身份已确认且仍在用的硕博成员", () => {
  const student = {
    role: "MEMBER" as const,
    status: "ACTIVE" as const,
    studyDegree: "MASTER" as const,
    identityNeedsReview: false,
  };
  assert.equal(isEligibleProjectLeaderActor(student), true);
  assert.equal(isEligibleProjectLeaderActor({ ...student, role: "ADMIN", studyDegree: null }), false);
  assert.equal(isEligibleProjectLeaderActor({ ...student, status: "SUSPENDED" }), false);
  assert.equal(isEligibleProjectLeaderActor({ ...student, studyDegree: "MENTOR" }), false);
  assert.equal(isEligibleProjectLeaderActor({ ...student, identityNeedsReview: true }), false);
});

test("导师只可软删自己负责的项目，管理员只走恢复或硬删路径", () => {
  const active = { advisorId: "advisor-1", deletedAt: null };
  const deleted = { advisorId: "advisor-1", deletedAt: new Date() };
  assert.equal(canSoftDeleteProjectSnapshot("advisor-1", active, new Set([PERMISSIONS.PROJECT_DELETE_ADVISED])), true);
  assert.equal(canSoftDeleteProjectSnapshot("advisor-2", active, new Set([PERMISSIONS.PROJECT_DELETE_ADVISED])), false);
  assert.equal(canSoftDeleteProjectSnapshot("admin", active, new Set([PERMISSIONS.PROJECT_DELETE_ANY])), false);
  assert.equal(canRestoreProjectSnapshot(deleted, new Set([PERMISSIONS.PROJECT_RESTORE])), true);
  assert.equal(canRestoreProjectSnapshot(active, new Set([PERMISSIONS.PROJECT_RESTORE])), false);
  assert.equal(canHardDeleteProjectSnapshot(new Set([PERMISSIONS.PROJECT_DELETE_ANY])), true);
});

test("项目参与者必须全部是所选导师的直属在读学生", () => {
  const candidates = [
    { id: "student-1", advisorId: "advisor-1" },
    { id: "student-2", advisorId: "advisor-1" },
    { id: "student-3", advisorId: "advisor-2" },
  ];
  assert.doesNotThrow(() =>
    assertParticipantsBelongToAdvisor("advisor-1", ["student-1", "student-2"], candidates),
  );
  assert.throws(
    () => assertParticipantsBelongToAdvisor("advisor-1", ["student-1", "student-3"], candidates),
    /直属在读学生/,
  );
});

test("硬删除事务必须先解除节点自关联并清理依赖，再删除项目和记录审计", async () => {
  const calls: string[] = [];
  const tx: ProjectHardDeleteTransaction = {
    project: {
      findUniqueOrThrow: async () => ({ id: "project-1", name: "项目一", deletedAt: new Date() }),
      delete: async () => { calls.push("project.delete"); },
    },
    projectNode: { updateMany: async () => { calls.push("nodes.detach"); } },
    notification: { deleteMany: async () => { calls.push("notifications.delete"); } },
    tag: { deleteMany: async () => { calls.push("tags.delete"); } },
    auditLog: { create: async () => { calls.push("audit.create"); } },
  };
  await applyHardDeleteProject(tx, {
    projectId: "project-1",
    actorId: "admin-1",
    actorSnapshot: createActorSnapshot({ displayName: "管理员", studyDegree: null, status: "ACTIVE" }),
  });
  assert.deepEqual(calls, ["nodes.detach", "notifications.delete", "tags.delete", "project.delete", "audit.create"]);
});
