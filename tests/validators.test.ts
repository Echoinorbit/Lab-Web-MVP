import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAdminUserStatusUpdate,
  type AdminUserStatusTransaction,
} from "../src/features/admin/lib/user-status-management";
import { assertCanUpdateStatusFromAdminPanel } from "../src/shared/lib/user-status";
import { createUserInputSchema, updateUserGradeInputSchema, updateUserStatusInputSchema } from "../src/shared/lib/validators/admin";
import { announcementInputSchema } from "../src/shared/lib/validators/announcements";
import { commentInputSchema, postInputSchema } from "../src/shared/lib/validators/posts";
import { projectMemberInputSchema } from "../src/shared/lib/validators/projects";
import { grantTagInputSchema } from "../src/shared/lib/validators/tags";

test("面向全体（ALL）的公告必须强制使用空的目标 ID 列表", () => {
  assert.equal(
    announcementInputSchema.safeParse({
      title: "通知",
      content: "正文",
      targetType: "ALL",
      targetIds: ["u1"],
    }).success,
    false,
  );
});

test("定向发布的公告必须提供至少一个目标 ID", () => {
  assert.equal(
    announcementInputSchema.safeParse({
      title: "通知",
      content: "正文",
      targetType: "TAG",
      targetIds: [],
    }).success,
    false,
  );
});

test("帖子输入应规范化标签，并拒绝空的 Markdown 正文", () => {
  assert.equal(
    postInputSchema.safeParse({
      title: "有效标题",
      content: "",
      category: "GENERAL",
      tags: ["lab"],
    }).success,
    false,
  );
  assert.equal(
    postInputSchema.safeParse({
      title: "有效标题",
      content: "正文",
      category: "GENERAL",
      tags: ["lab"],
    }).success,
    true,
  );
});

test("评论输入必须指定所属的目标帖子", () => {
  assert.equal(commentInputSchema.safeParse({ content: "评论" }).success, false);
  assert.equal(commentInputSchema.safeParse({ postId: "p1", content: "评论" }).success, true);
});

test("管理员创建用户的输入必须包含可供策略校验的密码字段", () => {
  assert.equal(
    createUserInputSchema.safeParse({
      username: "2024001",
      displayName: "张三",
      password: "short",
    }).success,
    false,
  );
});

test("管理员状态更新允许将用户置为已毕业，但已毕业行仍由服务端策略保护", () => {
  assert.equal(updateUserStatusInputSchema.safeParse({ userId: "u1", status: "GRADUATED" }).success, true);
  assert.doesNotThrow(() => assertCanUpdateStatusFromAdminPanel("ACTIVE"));
  assert.doesNotThrow(() => assertCanUpdateStatusFromAdminPanel("SUSPENDED"));
  assert.throws(() => assertCanUpdateStatusFromAdminPanel("GRADUATED"), /毕业流程/);
});

test("管理员年级更新只能选择系统支持的硕博年级标签", () => {
  assert.equal(updateUserGradeInputSchema.safeParse({ userId: "u1", grade: "研2" }).success, true);
  assert.equal(updateUserGradeInputSchema.safeParse({ userId: "u1", grade: "博5" }).success, true);
  assert.equal(updateUserGradeInputSchema.safeParse({ userId: "u1", grade: "本科4" }).success, false);
});

test("管理员状态更新应使用原子条件避免覆盖已毕业状态", async () => {
  const updateCalls: Parameters<AdminUserStatusTransaction["user"]["updateMany"]>[0][] = [];
  const auditCalls: Parameters<AdminUserStatusTransaction["auditLog"]["create"]>[0][] = [];
  const tx: AdminUserStatusTransaction = {
    user: {
      updateMany: async (args) => {
        updateCalls.push(args);
        return { count: 1 };
      },
      findUnique: async () => {
        throw new Error("状态更新成功时不应查询用户。");
      },
    },
    auditLog: {
      create: async (args) => {
        auditCalls.push(args);
      },
    },
    userTag: {
      updateMany: async () => ({ count: 0 }),
    },
  };

  await applyAdminUserStatusUpdate(tx, { adminId: "admin-1", userId: "u1", status: "SUSPENDED" });

  assert.deepEqual(updateCalls[0]?.where, { id: "u1", status: { not: "GRADUATED" } });
  assert.deepEqual(updateCalls[0]?.data, { status: "SUSPENDED", tokenVersion: { increment: 1 } });
  assert.equal(auditCalls.length, 1);
});

test("管理员将用户置为已毕业时应吊销会话并撤销有效 Tag", async () => {
  const updateCalls: Parameters<AdminUserStatusTransaction["user"]["updateMany"]>[0][] = [];
  const tagRevokeCalls: Parameters<AdminUserStatusTransaction["userTag"]["updateMany"]>[0][] = [];
  const tx: AdminUserStatusTransaction = {
    user: {
      updateMany: async (args) => {
        updateCalls.push(args);
        return { count: 1 };
      },
      findUnique: async () => {
        throw new Error("毕业状态更新成功时不应查询用户。");
      },
    },
    auditLog: {
      create: async () => undefined,
    },
    userTag: {
      updateMany: async (args) => {
        tagRevokeCalls.push(args);
        return { count: 2 };
      },
    },
  };

  await applyAdminUserStatusUpdate(tx, { adminId: "admin-1", userId: "u1", status: "GRADUATED" });

  assert.deepEqual(updateCalls[0]?.where, { id: "u1", status: { not: "GRADUATED" } });
  assert.deepEqual(updateCalls[0]?.data, { status: "GRADUATED", tokenVersion: { increment: 1 } });
  assert.equal(tagRevokeCalls[0]?.where.userId, "u1");
  assert.equal(tagRevokeCalls[0]?.where.revokedAt, null);
  assert.equal(tagRevokeCalls[0]?.data.revokedAt instanceof Date, true);
});

test("管理员状态更新应拒绝已毕业目标且不写入审计", async () => {
  let auditCalled = false;
  const tx: AdminUserStatusTransaction = {
    user: {
      updateMany: async () => ({ count: 0 }),
      findUnique: async () => ({ status: "GRADUATED" }),
    },
    auditLog: {
      create: async () => {
        auditCalled = true;
      },
    },
    userTag: {
      updateMany: async () => ({ count: 0 }),
    },
  };

  await assert.rejects(() => applyAdminUserStatusUpdate(tx, { adminId: "admin-1", userId: "u1", status: "ACTIVE" }), /毕业流程/);
  assert.equal(auditCalled, false);
});

test("项目成员添加与 Tag 授予的输入契约必须保留显式的 ID 字段", () => {
  assert.equal(projectMemberInputSchema.safeParse({ projectId: "p1", userId: "u1" }).success, true);
  assert.equal(grantTagInputSchema.safeParse({ userId: "u1", tagId: "t1" }).success, true);
});
