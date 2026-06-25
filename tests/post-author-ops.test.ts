import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveCommentDeleteAccess,
  resolvePostDeleteAccess,
  resolvePostUpdateAccess,
} from "../src/features/posts/lib/author-ops";
import { CONTENT_AUTHOR_PERMISSIONS, PERMISSIONS, type Permission } from "../src/shared/lib/permissions";

function permissionSet(...permissions: Permission[]) {
  return new Set(permissions);
}

test("内容作者权限包应包含自管理权限且不包含版主任意删除权限", () => {
  const permissions = new Set<Permission>(CONTENT_AUTHOR_PERMISSIONS);
  assert.equal(permissions.has(PERMISSIONS.POST_CREATE), true);
  assert.equal(permissions.has(PERMISSIONS.POST_UPDATE_OWN), true);
  assert.equal(permissions.has(PERMISSIONS.POST_DELETE_OWN), true);
  assert.equal(permissions.has(PERMISSIONS.COMMENT_CREATE), true);
  assert.equal(permissions.has(PERMISSIONS.COMMENT_DELETE_OWN), true);
  assert.equal(permissions.has(PERMISSIONS.POST_DELETE_ANY), false);
  assert.equal(permissions.has(PERMISSIONS.COMMENT_DELETE_ANY), false);
});

test("作者持有 own 权限时可编辑自己的帖子", () => {
  assert.deepEqual(
    resolvePostUpdateAccess({
      userId: "author",
      authorId: "author",
      permissions: permissionSet(PERMISSIONS.POST_UPDATE_OWN),
    }),
    { allowed: true, scope: "own", permission: PERMISSIONS.POST_UPDATE_OWN },
  );
});

test("非作者即使持有 own 权限也不能编辑他人帖子", () => {
  assert.deepEqual(
    resolvePostUpdateAccess({
      userId: "reader",
      authorId: "author",
      permissions: permissionSet(PERMISSIONS.POST_UPDATE_OWN),
    }),
    { allowed: false, scope: "denied", permission: PERMISSIONS.POST_UPDATE_OWN },
  );
});

test("删帖允许作者 own 路径并保留版主 any 路径", () => {
  assert.deepEqual(
    resolvePostDeleteAccess({
      userId: "author",
      authorId: "author",
      permissions: permissionSet(PERMISSIONS.POST_DELETE_OWN),
    }),
    { allowed: true, scope: "own", permission: PERMISSIONS.POST_DELETE_OWN },
  );
  assert.deepEqual(
    resolvePostDeleteAccess({
      userId: "moderator",
      authorId: "author",
      permissions: permissionSet(PERMISSIONS.POST_DELETE_ANY),
    }),
    { allowed: true, scope: "any", permission: PERMISSIONS.POST_DELETE_ANY },
  );
});

test("非作者非版主删帖应要求任意删除权限", () => {
  assert.deepEqual(
    resolvePostDeleteAccess({
      userId: "reader",
      authorId: "author",
      permissions: permissionSet(PERMISSIONS.POST_DELETE_OWN),
    }),
    { allowed: false, scope: "denied", permission: PERMISSIONS.POST_DELETE_ANY },
  );
});

test("删评论允许作者 own 路径并保留版主 any 路径", () => {
  assert.deepEqual(
    resolveCommentDeleteAccess({
      userId: "comment-author",
      authorId: "comment-author",
      permissions: permissionSet(PERMISSIONS.COMMENT_DELETE_OWN),
    }),
    { allowed: true, scope: "own", permission: PERMISSIONS.COMMENT_DELETE_OWN },
  );
  assert.deepEqual(
    resolveCommentDeleteAccess({
      userId: "moderator",
      authorId: "comment-author",
      permissions: permissionSet(PERMISSIONS.COMMENT_DELETE_ANY),
    }),
    { allowed: true, scope: "any", permission: PERMISSIONS.COMMENT_DELETE_ANY },
  );
});
