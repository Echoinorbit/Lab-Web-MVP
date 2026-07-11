import assert from "node:assert/strict";
import test from "node:test";

import {
  ANNOUNCEMENT_CREATE_PERMISSION,
  ANNOUNCEMENT_CREATE_ROUTE,
  ANNOUNCEMENT_ENTITY_TYPE,
  ANNOUNCEMENT_LIST_ROUTE,
  resolveAnnouncementUpdateAccess,
} from "../src/features/announcements/lib/access";
import {
  ANNOUNCEMENT_ORDER_BY,
  compareAnnouncementsForDisplay,
} from "../src/features/announcements/lib/sorting";
import {
  resolveProjectAnnouncementRecipientIds,
  uniqueAnnouncementRecipientIds,
} from "../src/features/announcements/lib/recipients";
import { ALL_TARGET_LABEL } from "../src/features/announcements/lib/target-copy";
import {
  canViewAnnouncementFromSnapshot,
  getDefaultAnnouncementExpiresAt,
  isAnnouncementActive,
  type AnnouncementVisibilityViewer,
} from "../src/features/announcements/lib/visibility";
import { PERMISSIONS } from "../src/shared/lib/permissions";

test("公告发布页应使用独立路由并复用创建权限", () => {
  assert.equal(ANNOUNCEMENT_LIST_ROUTE, "/announcements");
  assert.equal(ANNOUNCEMENT_CREATE_ROUTE, "/announcements/new");
  assert.equal(ANNOUNCEMENT_ENTITY_TYPE, "Announcement");
  assert.equal(ANNOUNCEMENT_CREATE_PERMISSION, PERMISSIONS.ANNOUNCEMENT_CREATE);
});

test("公告编辑允许管理员治理和具备权限的作者本人，拒绝其他导师", () => {
  const capable = new Set([PERMISSIONS.ANNOUNCEMENT_UPDATE]);
  assert.deepEqual(resolveAnnouncementUpdateAccess({
    actorId: "admin",
    actorRole: "ADMIN",
    authorId: "author",
    permissions: capable,
  }), { allowed: true, scope: "admin" });
  assert.deepEqual(resolveAnnouncementUpdateAccess({
    actorId: "author",
    actorRole: "MEMBER",
    authorId: "author",
    permissions: capable,
  }), { allowed: true, scope: "author" });
  assert.deepEqual(resolveAnnouncementUpdateAccess({
    actorId: "other-advisor",
    actorRole: "MEMBER",
    authorId: "author",
    permissions: capable,
  }), { allowed: false });
  assert.deepEqual(resolveAnnouncementUpdateAccess({
    actorId: "author",
    actorRole: "MEMBER",
    authorId: "author",
    permissions: new Set(),
  }), { allowed: false });
});

test("全员公告目标文案不应暴露 targetIds 底层结构", () => {
  assert.equal(ALL_TARGET_LABEL, "发送给全体成员");
  assert.equal(ALL_TARGET_LABEL.includes("targetIds"), false);
});

test("项目公告收件人应包含项目组长与成员、去重并排除发布者", () => {
  assert.deepEqual(uniqueAnnouncementRecipientIds(["u1", "u1", "author", "u2"], "author"), ["u1", "u2"]);
  assert.deepEqual(
    resolveProjectAnnouncementRecipientIds({
      leadUserIds: ["lead-1", "member-1"],
      memberUserIds: ["member-1", "member-2", "author"],
      authorId: "author",
    }),
    ["lead-1", "member-1", "member-2"],
  );
});

test("公告查询排序应为置顶优先、紧急其次、时间倒序", () => {
  assert.deepEqual(ANNOUNCEMENT_ORDER_BY, [{ isPinned: "desc" }, { isUrgent: "desc" }, { createdAt: "desc" }]);
});

test("公告展示排序比较器应匹配查询排序语义", () => {
  const sortedIds = [
    { id: "normal-new", isPinned: false, isUrgent: false, createdAt: "2026-06-25T03:00:00.000Z" },
    { id: "urgent-old", isPinned: false, isUrgent: true, createdAt: "2026-06-25T01:00:00.000Z" },
    { id: "pinned-normal-old", isPinned: true, isUrgent: false, createdAt: "2026-06-25T00:00:00.000Z" },
    { id: "pinned-urgent-old", isPinned: true, isUrgent: true, createdAt: "2026-06-24T23:00:00.000Z" },
    { id: "pinned-urgent-new", isPinned: true, isUrgent: true, createdAt: "2026-06-25T02:00:00.000Z" },
  ]
    .slice()
    .sort(compareAnnouncementsForDisplay)
    .map((announcement) => announcement.id);

  assert.deepEqual(sortedIds, [
    "pinned-urgent-new",
    "pinned-urgent-old",
    "pinned-normal-old",
    "urgent-old",
    "normal-new",
  ]);
});

test("公告默认生命周期应为 72 小时", () => {
  const now = new Date("2026-06-25T00:00:00.000Z");
  assert.equal(getDefaultAnnouncementExpiresAt(now).toISOString(), "2026-06-28T00:00:00.000Z");
  assert.equal(isAnnouncementActive({ expiresAt: "2026-06-25T00:00:01.000Z" }, now), true);
  assert.equal(isAnnouncementActive({ expiresAt: "2026-06-24T23:59:59.000Z" }, now), false);
});

test("公告可见性应按目标类型限制普通用户，管理员可治理查看", () => {
  const viewer: AnnouncementVisibilityViewer = {
    id: "user-1",
    role: "MEMBER",
    tagIds: ["tag-1"],
    projectIds: ["project-1"],
  };
  const admin: AnnouncementVisibilityViewer = { id: "admin-1", role: "ADMIN", tagIds: [], projectIds: [] };

  assert.equal(canViewAnnouncementFromSnapshot(viewer, { targetType: "ALL", targetIds: [] }), true);
  assert.equal(canViewAnnouncementFromSnapshot(viewer, { targetType: "USERS", targetIds: ["user-1"] }), true);
  assert.equal(canViewAnnouncementFromSnapshot(viewer, { targetType: "USERS", targetIds: ["user-2"] }), false);
  assert.equal(canViewAnnouncementFromSnapshot(viewer, { targetType: "TAG", targetIds: ["tag-1"] }), true);
  assert.equal(canViewAnnouncementFromSnapshot(viewer, { targetType: "PROJECT", targetIds: ["project-1"] }), true);
  assert.equal(canViewAnnouncementFromSnapshot(viewer, { targetType: "PROJECT", targetIds: ["project-2"] }), false);
  assert.equal(
    canViewAnnouncementFromSnapshot(viewer, {
      authorId: "user-1",
      targetType: "PROJECT",
      targetIds: ["project-2"],
    }),
    true,
  );
  assert.equal(canViewAnnouncementFromSnapshot(admin, { targetType: "USERS", targetIds: ["user-2"] }), true);
  assert.equal(canViewAnnouncementFromSnapshot(admin, { targetType: "ALL", targetIds: [], deletedAt: new Date() }), false);
});
