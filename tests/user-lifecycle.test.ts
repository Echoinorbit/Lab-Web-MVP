import assert from "node:assert/strict";
import test from "node:test";

import {
  assertManualUserDeletionPolicy,
  getDeletionSnapshotState,
  getPurgeResponseStatus,
  isScheduledUserDeletionDue,
} from "../src/features/admin/lib/delete-user-account";
import {
  restoreStudyIdentityAfterCancelledGraduation,
  revokeTagsForGraduation,
} from "../src/features/admin/lib/user-lifecycle";
import { orderUserLifecycleLockIds } from "../src/shared/lib/user-lifecycle-lock";

const target = {
  id: "target",
  username: "target-user",
  role: "MEMBER" as const,
  status: "GRADUATED" as const,
  studyDegree: "MASTER" as const,
  identityNeedsReview: false,
  scheduledDeletionAt: new Date("2026-07-13T00:00:00.000Z"),
};

test("毕业清理在账号或头像清理失败时返回部分成功状态", () => {
  assert.equal(getPurgeResponseStatus(0, 0), 200);
  assert.equal(getPurgeResponseStatus(1, 0), 207);
  assert.equal(getPurgeResponseStatus(0, 1), 207);
});

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

test("毕业撤销全部旧授权，取消毕业只恢复培养身份 Tag", async () => {
  const updates: unknown[] = [];
  const creates: unknown[] = [];
  const tagNames: string[] = [];
  const transaction = {
    userTag: {
      updateMany: async (args: unknown) => { updates.push(args); return { count: 1 }; },
      create: async (args: unknown) => { creates.push(args); return { id: `grant-${creates.length}` }; },
    },
    tag: {
      findFirstOrThrow: async (args: { where: { name: string } }) => {
        tagNames.push(args.where.name);
        return { id: `tag-${args.where.name}` };
      },
    },
  };
  const now = new Date("2026-07-10T00:00:00.000Z");
  const actorSnapshot = {
    v: 1 as const,
    displayName: "治理管理员",
    studyDegree: null,
    accountState: "ACTIVE" as const,
    capturedAt: now.toISOString(),
  };

  await revokeTagsForGraduation(
    transaction as unknown as Parameters<typeof revokeTagsForGraduation>[0],
    { userId: "student", actorId: "admin", actorSnapshot, now },
  );
  await restoreStudyIdentityAfterCancelledGraduation(
    transaction as unknown as Parameters<typeof restoreStudyIdentityAfterCancelledGraduation>[0],
    { userId: "student", actorId: "admin", actorSnapshot, now, studyDegree: "MASTER" },
  );

  assert.deepEqual(tagNames, ["graduated", "grad-master"]);
  assert.deepEqual(updates, [
    {
      where: { userId: "student", revokedAt: null },
      data: { revokedAt: now, revokedById: "admin", revokerSnapshot: actorSnapshot },
    },
    {
      where: { userId: "student", revokedAt: null, projectId: null, tag: { name: "graduated" } },
      data: { revokedAt: now, revokedById: "admin", revokerSnapshot: actorSnapshot },
    },
  ]);
  assert.equal(creates.length, 2);
  assert.deepEqual(creates[1], {
    data: {
      userId: "student",
      tagId: "tag-grad-master",
      source: "STUDY_IDENTITY",
      grantedById: "admin",
      granterSnapshot: actorSnapshot,
    },
  });
});

test("跨项目批量成员变更以稳定顺序获取用户生命周期锁", () => {
  assert.deepEqual(orderUserLifecycleLockIds(["user-b", "user-a", "user-b", "user-c"]), [
    "user-a",
    "user-b",
    "user-c",
  ]);
});
