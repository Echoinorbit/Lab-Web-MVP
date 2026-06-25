import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUserPostTagDeleteWhere,
  buildUserPostTagListArgs,
  buildUserPostTagUpsertArgs,
  mergePostTagLabels,
  normalizePostTagLabel,
  postTagLabelSchema,
} from "../src/features/posts/lib/post-tags";

test("个人帖子标签应规范化空白并限制长度", () => {
  assert.equal(normalizePostTagLabel("  标签  "), "标签");
  assert.equal(postTagLabelSchema.safeParse("").success, false);
  assert.equal(postTagLabelSchema.safeParse("a".repeat(41)).success, false);
});

test("发帖标签应合并已有选择与新增标签并去重", () => {
  assert.deepEqual(mergePostTagLabels(["科研", "AI"], ["AI", "写作", " "]), ["科研", "AI", "写作"]);
});

test("个人帖子标签查询只能读取当前用户自己的标签", () => {
  assert.deepEqual(buildUserPostTagListArgs("user-a"), {
    where: { userId: "user-a" },
    orderBy: { label: "asc" },
    select: { id: true, label: true },
  });
});

test("个人帖子标签创建应走 userId + label 唯一键并规范化标签", () => {
  assert.deepEqual(buildUserPostTagUpsertArgs("user-a", "  科研  "), {
    where: { userId_label: { userId: "user-a", label: "科研" } },
    create: { userId: "user-a", label: "科研" },
    update: {},
    select: { id: true, label: true },
  });
});

test("个人帖子标签删除必须同时约束 owner 与标签 ID", () => {
  assert.deepEqual(buildUserPostTagDeleteWhere("user-a", "tag-1"), { id: "tag-1", userId: "user-a" });
});
