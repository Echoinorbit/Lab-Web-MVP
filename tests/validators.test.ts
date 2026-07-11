import assert from "node:assert/strict";
import test from "node:test";

import { assertCanUpdateStatusFromAdminPanel } from "../src/shared/lib/user-status";
import {
  createUserInputSchema,
  deleteUserAccountInputSchema,
  updateSystemSettingsInputSchema,
  updateUserGradeInputSchema,
  updateUserIdentityInputSchema,
  updateUserStatusInputSchema,
  updateUserStudyIdentityInputSchema,
} from "../src/shared/lib/validators/admin";
import { announcementInputSchema } from "../src/shared/lib/validators/announcements";
import { commentInputSchema, postInputSchema } from "../src/shared/lib/validators/posts";
import {
  projectMembersInputSchema,
  updateProjectInputSchema,
} from "../src/shared/lib/validators/projects";
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

test("管理员身份更新应规范化空学号并校验用户名与姓名", () => {
  const parsed = updateUserIdentityInputSchema.parse({
    userId: "u1",
    username: " updated-user ",
    displayName: " 更新姓名 ",
    studentId: " ",
  });
  assert.deepEqual(parsed, {
    userId: "u1",
    username: "updated-user",
    displayName: "更新姓名",
    studentId: null,
  });
});

test("管理员状态更新允许将用户置为已毕业，但已毕业行仍由服务端策略保护", () => {
  assert.equal(updateUserStatusInputSchema.safeParse({ userId: "u1", status: "GRADUATED" }).success, true);
  assert.doesNotThrow(() => assertCanUpdateStatusFromAdminPanel("ACTIVE"));
  assert.doesNotThrow(() => assertCanUpdateStatusFromAdminPanel("SUSPENDED"));
  assert.throws(() => assertCanUpdateStatusFromAdminPanel("GRADUATED"), /毕业流程/);
});

test("管理员年级更新只接受规范化的硕博年级枚举", () => {
  assert.equal(updateUserGradeInputSchema.safeParse({ userId: "u1", studyGrade: "MASTER_2" }).success, true);
  assert.equal(updateUserGradeInputSchema.safeParse({ userId: "u1", studyGrade: "DOCTOR_5" }).success, true);
  assert.equal(updateUserGradeInputSchema.safeParse({ userId: "u1", studyGrade: "研2" }).success, false);
});

test("培养身份编辑与创建使用同一组学位年级约束", () => {
  assert.equal(updateUserStudyIdentityInputSchema.safeParse({
    userId: "u1",
    studyDegree: "MASTER",
    studyGrade: "MASTER_2",
  }).success, true);
  assert.equal(updateUserStudyIdentityInputSchema.safeParse({
    userId: "u1",
    studyDegree: "DOCTOR",
    studyGrade: "MASTER_2",
  }).success, false);
  assert.equal(updateUserStudyIdentityInputSchema.safeParse({
    userId: "u1",
    studyDegree: "MENTOR",
    studyGrade: "DOCTOR_1",
  }).success, false);
});

test("系统设置输入只接受持久化策略的静态边界", () => {
  assert.equal(updateSystemSettingsInputSchema.safeParse({
    revision: 0,
    progressStartDay: 1,
    progressStartMinute: 0,
    progressEndDay: 31,
    progressEndMinute: 1439,
    sessionHours: 720,
  }).success, true);
  assert.equal(updateSystemSettingsInputSchema.safeParse({
    revision: -1,
    progressStartDay: 0,
    progressStartMinute: -1,
    progressEndDay: 32,
    progressEndMinute: 1440,
    sessionHours: 721,
  }).success, false);
});

test("永久删除要求显式目标与非空确认用户名", () => {
  assert.equal(deleteUserAccountInputSchema.safeParse({ userId: "u1", confirmUsername: "target" }).success, true);
  assert.equal(deleteUserAccountInputSchema.safeParse({ userId: "u1", confirmUsername: "  " }).success, false);
});

test("Tag 授予输入契约必须保留显式的 ID 字段", () => {
  assert.equal(grantTagInputSchema.safeParse({ userId: "u1", tagId: "t1" }).success, true);
});

test("项目信息编辑仅接受名称、简介与显式项目 ID", () => {
  assert.equal(updateProjectInputSchema.safeParse({ projectId: "project-1", name: "新名称", description: "简介" }).success, true);
  assert.equal(updateProjectInputSchema.safeParse({ name: "新名称" }).success, false);
});

test("项目成员树应支持一次提交多个成员并拒绝空选择", () => {
  assert.equal(projectMembersInputSchema.safeParse({ projectId: "project-1", userIds: ["user-1", "user-2"] }).success, true);
  assert.equal(projectMembersInputSchema.safeParse({ projectId: "project-1", userIds: [] }).success, false);
});
