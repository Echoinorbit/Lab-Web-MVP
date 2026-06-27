import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAdminUserRoleUpdate,
  buildUserIdentityUpdateData,
  canAssignAdvisorToTarget,
  type AdminUserRoleTransaction,
} from "../src/features/admin/lib/user-governance";

test("ADMIN 和有效导师不能绑定导师，普通成员可以", () => {
  assert.equal(canAssignAdvisorToTarget({ role: "ADMIN", hasAdvisorTag: false }), false);
  assert.equal(canAssignAdvisorToTarget({ role: "MEMBER", hasAdvisorTag: true }), false);
  assert.equal(canAssignAdvisorToTarget({ role: "MEMBER", hasAdvisorTag: false }), true);
});

test("用户名变更应吊销旧会话，其他身份字段更新不递增 tokenVersion", () => {
  assert.deepEqual(
    buildUserIdentityUpdateData(
      { username: "old", displayName: "旧姓名", studentId: "S1" },
      { username: "new", displayName: "新姓名", studentId: null },
    ),
    { username: "new", displayName: "新姓名", studentId: null, tokenVersion: { increment: 1 } },
  );
  assert.deepEqual(
    buildUserIdentityUpdateData(
      { username: "same", displayName: "旧姓名", studentId: "S1" },
      { username: "same", displayName: "新姓名", studentId: "S2" },
    ),
    { username: "same", displayName: "新姓名", studentId: "S2" },
  );
});

test("转为 ADMIN 应清空导师、吊销会话并撤销全部有效 Tag", async () => {
  const updates: unknown[] = [];
  const revokes: unknown[] = [];
  const audits: unknown[] = [];
  const tx: AdminUserRoleTransaction = {
    user: { update: async (args) => { updates.push(args); } },
    userTag: { updateMany: async (args) => { revokes.push(args); return { count: 3 }; } },
    auditLog: { create: async (args) => { audits.push(args); } },
  };

  await applyAdminUserRoleUpdate(tx, {
    adminId: "admin-1",
    userId: "user-1",
    role: "ADMIN",
    now: new Date("2026-06-25T00:00:00.000Z"),
  });

  assert.deepEqual(updates[0], {
    where: { id: "user-1" },
    data: { role: "ADMIN", advisorId: null, tokenVersion: { increment: 1 } },
  });
  assert.deepEqual(revokes[0], {
    where: { userId: "user-1", revokedAt: null },
    data: { revokedAt: new Date("2026-06-25T00:00:00.000Z"), revokedById: "admin-1" },
  });
  assert.equal(audits.length, 1);
});
