import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMyDraftsWhere,
  buildPublicPostWhere,
  buildVisiblePostWhere,
  shouldAutosaveDraft,
} from "../src/features/posts/lib/drafts";
import { formatPostValidationError } from "../src/features/posts/lib/post-validation-copy";
import { draftInputSchema, publishPostInputSchema } from "../src/shared/lib/validators/posts";

test("公开帖子查询应排除草稿和软删除帖子", () => {
  assert.deepEqual(buildPublicPostWhere(), { status: "PUBLISHED", deletedAt: null });
});

test("帖子详情可见性应允许公开帖子或作者自己的草稿", () => {
  assert.deepEqual(buildVisiblePostWhere("user-a", "post-1"), {
    id: "post-1",
    deletedAt: null,
    OR: [{ status: "PUBLISHED" }, { status: "DRAFT", authorId: "user-a" }],
  });
});

test("我的草稿查询只能读取当前作者的未删除草稿", () => {
  assert.deepEqual(buildMyDraftsWhere("user-a"), {
    authorId: "user-a",
    status: "DRAFT",
    deletedAt: null,
  });
});

test("草稿至少需要标题或正文，但发布仍要求完整标题和正文", () => {
  assert.equal(draftInputSchema.safeParse({}).success, false);
  assert.equal(draftInputSchema.safeParse({ title: "  临时想法  " }).success, true);
  assert.equal(draftInputSchema.safeParse({ content: "正文" }).success, true);

  assert.equal(
    publishPostInputSchema.safeParse({
      postId: "draft-1",
      title: "A",
      content: "正文",
      category: "GENERAL",
      tags: [],
    }).success,
    false,
  );
  assert.equal(
    publishPostInputSchema.safeParse({
      postId: "draft-1",
      title: "正式标题",
      content: "正文",
      category: "GENERAL",
      tags: [],
    }).success,
    true,
  );
});

test("发布草稿校验错误应转换为可读中文提示", () => {
  const parsed = publishPostInputSchema.safeParse({
    postId: "draft-1",
    title: "A",
    content: "正文",
    category: "GENERAL",
    tags: [],
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(formatPostValidationError(parsed.error, "保存失败"), "标题至少需要 2 个字符。");
  }
});

test("自动保存只应在标题或正文非空时触发", () => {
  assert.equal(shouldAutosaveDraft({ title: "", content: "" }), false);
  assert.equal(shouldAutosaveDraft({ title: "  ", content: "\n" }), false);
  assert.equal(shouldAutosaveDraft({ title: "草稿", content: "" }), true);
  assert.equal(shouldAutosaveDraft({ title: "", content: "正文" }), true);
});
