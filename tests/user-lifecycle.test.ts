import assert from "node:assert/strict";
import test from "node:test";

import {
  assertManualUserDeletionPolicy,
  getDeletionSnapshotState,
  isScheduledUserDeletionDue,
} from "../src/features/admin/lib/delete-user-account";

const target = {
  id: "target",
  username: "target-user",
  role: "MEMBER" as const,
  status: "GRADUATED" as const,
  studyDegree: "MASTER" as const,
  identityNeedsReview: false,
  scheduledDeletionAt: new Date("2026-07-13T00:00:00.000Z"),
};

test("自动清理仅选择到期且身份已确认的毕业硕博账号", () => {
  const dueAt = new Date("2026-07-13T00:00:00.000Z");
  assert.equal(isScheduledUserDeletionDue(target, dueAt), true);
  assert.equal(isScheduledUserDeletionDue(target, new Date(dueAt.getTime() - 1)), false);
  assert.equal(isScheduledUserDeletionDue({ ...target, status: "ACTIVE" }, dueAt), false);
  assert.equal(isScheduledUserDeletionDue({ ...target, studyDegree: "MENTOR" }, dueAt), false);
  assert.equal(isScheduledUserDeletionDue({ ...target, identityNeedsReview: true }, dueAt), false);
  assert.equal(isScheduledUserDeletionDue({ ...target, scheduledDeletionAt: null }, dueAt), false);
});

test("毕业自动清理保留已毕业署名，管理员永久删除标记账号已删除", () => {
  assert.equal(getDeletionSnapshotState({ kind: "scheduled" }), "GRADUATED");
  assert.equal(
    getDeletionSnapshotState({ kind: "manual", actorId: "admin-1", confirmUsername: "member-1" }),
    "DELETED",
  );
});

test("手动永久删除拒绝自删、错误用户名和最后一个有效管理员", () => {
  assert.throws(() => assertManualUserDeletionPolicy({
    actorId: "target",
    confirmUsername: target.username,
    target,
  }), /不能删除自己的账号/);
  assert.throws(() => assertManualUserDeletionPolicy({
    actorId: "admin",
    confirmUsername: "wrong",
    target,
  }), /确认用户名不匹配/);
  assert.throws(() => assertManualUserDeletionPolicy({
    actorId: "other-admin",
    confirmUsername: "admin-target",
    target: {
      ...target,
      username: "admin-target",
      role: "ADMIN",
      status: "ACTIVE",
      studyDegree: null,
      scheduledDeletionAt: null,
    },
    activeAdminCount: 1,
  }), /最后一个有效管理员/);
  assert.doesNotThrow(() => assertManualUserDeletionPolicy({
    actorId: "other-admin",
    confirmUsername: "admin-target",
    target: {
      ...target,
      username: "admin-target",
      role: "ADMIN",
      status: "ACTIVE",
      studyDegree: null,
      scheduledDeletionAt: null,
    },
    activeAdminCount: 2,
  }));
});
