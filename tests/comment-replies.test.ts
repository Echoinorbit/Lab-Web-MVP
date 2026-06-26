import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReplyParentWhere,
  canReplyToCommentSnapshot,
} from "../src/features/posts/lib/comment-replies";
import {
  buildCommentTree,
  type CommentTreeSource,
} from "../src/features/posts/lib/comment-tree";

function comment(input: Partial<CommentTreeSource> & Pick<CommentTreeSource, "id">): CommentTreeSource {
  return {
    id: input.id,
    content: input.content ?? input.id,
    createdAt: input.createdAt ?? new Date("2026-06-01T00:00:00.000Z"),
    parentId: input.parentId ?? null,
    deletedAt: input.deletedAt ?? null,
    author: input.author ?? { id: `author-${input.id}`, displayName: `作者 ${input.id}` },
  };
}

test("回复父级查询接受同帖子的任意未删除评论", () => {
  assert.deepEqual(buildReplyParentWhere("post-1", "comment-1"), {
    id: "comment-1",
    postId: "post-1",
    deletedAt: null,
  });
});

test("可以回复同帖子的嵌套评论，但不能回复跨帖或已删除评论", () => {
  assert.equal(
    canReplyToCommentSnapshot(
      { postId: "post-1", parentId: "comment-root", deletedAt: null },
      "post-1",
    ),
    true,
  );
  assert.equal(
    canReplyToCommentSnapshot({ postId: "post-1", parentId: null, deletedAt: null }, "post-1"),
    true,
  );
  assert.equal(
    canReplyToCommentSnapshot({ postId: "post-2", parentId: null, deletedAt: null }, "post-1"),
    false,
  );
  assert.equal(
    canReplyToCommentSnapshot({ postId: "post-1", parentId: null, deletedAt: new Date() }, "post-1"),
    false,
  );
});

test("删除的父评论有可见回复时应保留占位楼层", () => {
  const tree = buildCommentTree([
    comment({ id: "root", deletedAt: new Date("2026-06-02T00:00:00.000Z") }),
    comment({ id: "reply", parentId: "root", content: "仍然可见" }),
  ]);

  assert.equal(tree.length, 1);
  assert.equal(tree[0].id, "root");
  assert.equal(tree[0].isDeleted, true);
  assert.equal(tree[0].content, "");
  assert.equal(tree[0].authorId, "");
  assert.equal(tree[0].authorName, "已删除评论");
  assert.deepEqual(tree[0].children?.map((child) => child.id), ["reply"]);
});

test("删除且没有可见回复的评论不应出现在评论树中", () => {
  const tree = buildCommentTree([
    comment({ id: "visible" }),
    comment({ id: "deleted-leaf", deletedAt: new Date("2026-06-02T00:00:00.000Z") }),
  ]);

  assert.deepEqual(tree.map((row) => row.id), ["visible"]);
});
