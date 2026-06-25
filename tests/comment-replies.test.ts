import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReplyParentWhere,
  canReplyToCommentSnapshot,
} from "../src/features/posts/lib/comment-replies";

test("回复父级查询只接受同帖子的顶层未删除评论", () => {
  assert.deepEqual(buildReplyParentWhere("post-1", "comment-1"), {
    id: "comment-1",
    postId: "post-1",
    parentId: null,
    deletedAt: null,
  });
});

test("不能回复已是回复的评论", () => {
  assert.equal(
    canReplyToCommentSnapshot(
      { postId: "post-1", parentId: "comment-root", deletedAt: null },
      "post-1",
    ),
    false,
  );
  assert.equal(
    canReplyToCommentSnapshot({ postId: "post-1", parentId: null, deletedAt: null }, "post-1"),
    true,
  );
});
