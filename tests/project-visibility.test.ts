import assert from "node:assert/strict";
import test from "node:test";

import {
  canViewProject,
  getMyProjectWhere,
  getProjectVisibilityWhere,
  hasGlobalAdvisorTag,
  parseProjectListTab,
  type ProjectVisibilityViewer,
} from "../src/features/projects/lib/visibility";
import { summarizeProjectDescription } from "../src/features/projects/lib/preview";
import { ADVISOR_TAG_NAME } from "../src/shared/lib/system-tags";

const admin: ProjectVisibilityViewer = { id: "admin-1", role: "ADMIN", tags: [] };
const advisor: ProjectVisibilityViewer = {
  id: "advisor-1",
  role: "MEMBER",
  tags: [{ name: ADVISOR_TAG_NAME, projectId: null }],
};
const member: ProjectVisibilityViewer = { id: "member-1", role: "MEMBER", tags: [] };

test("项目列表可见性：管理员全量、导师看负责或参与项目、成员只看加入项目", () => {
  assert.deepEqual(getProjectVisibilityWhere(admin), { deletedAt: null });
  assert.deepEqual(getProjectVisibilityWhere(advisor), {
    deletedAt: null,
    OR: [{ advisorId: "advisor-1" }, { members: { some: { userId: "advisor-1" } } }],
  });
  assert.deepEqual(getProjectVisibilityWhere(member), { deletedAt: null, members: { some: { userId: "member-1" } } });
});

test("项目列表 Tab 参数只接受 all 与 mine", () => {
  assert.equal(parseProjectListTab(undefined), "all");
  assert.equal(parseProjectListTab("all"), "all");
  assert.equal(parseProjectListTab("mine"), "mine");
  assert.equal(parseProjectListTab("other"), "all");
  assert.equal(parseProjectListTab(["mine", "all"]), "mine");
});

test("我的项目查询应按角色收敛到创建、负责或参与范围", () => {
  assert.deepEqual(getMyProjectWhere(admin), {
    deletedAt: null,
    OR: [{ creatorId: "admin-1" }, { advisorId: "admin-1" }, { members: { some: { userId: "admin-1" } } }],
  });
  assert.deepEqual(getMyProjectWhere(advisor), {
    deletedAt: null,
    OR: [{ advisorId: "advisor-1" }, { members: { some: { userId: "advisor-1" } } }],
  });
  assert.deepEqual(getMyProjectWhere(member), { deletedAt: null, members: { some: { userId: "member-1" } } });
});

test("只有全局 advisor Tag 才启用导师项目范围", () => {
  assert.equal(hasGlobalAdvisorTag(advisor), true);
  assert.equal(hasGlobalAdvisorTag({ tags: [{ name: ADVISOR_TAG_NAME, projectId: "project-1" }] }), false);
  assert.equal(hasGlobalAdvisorTag({ tags: [{ name: "grad-master", projectId: null }] }), false);
});

test("项目详情可见性应拒绝跨导师和非成员访问", () => {
  assert.equal(canViewProject(admin, { advisorId: "someone-else", members: [] }), true);
  assert.equal(canViewProject(advisor, { advisorId: "advisor-1", members: [] }), true);
  assert.equal(canViewProject(advisor, { advisorId: "advisor-2", members: [{ userId: "advisor-1" }] }), true);
  assert.equal(canViewProject(advisor, { advisorId: "advisor-2", members: [] }), false);
  assert.equal(canViewProject(member, { advisorId: "advisor-1", members: [{ userId: "member-1" }] }), true);
  assert.equal(canViewProject(member, { advisorId: "advisor-1", members: [{ userId: "member-2" }] }), false);
});

test("项目预览描述应压缩空白、为空时回退并限制长度", () => {
  assert.equal(summarizeProjectDescription(null), "暂无描述");
  assert.equal(summarizeProjectDescription("  第一行\n第二行  "), "第一行 第二行");
  assert.equal(summarizeProjectDescription("abcdef", 4), "abc…");
});
