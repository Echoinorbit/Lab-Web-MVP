import assert from "node:assert/strict";
import test from "node:test";

import {
  ANNOUNCEMENT_CREATE_PERMISSION,
  ANNOUNCEMENT_CREATE_ROUTE,
  ANNOUNCEMENT_ENTITY_TYPE,
  ANNOUNCEMENT_LIST_ROUTE,
} from "../src/features/announcements/lib/access";
import {
  ANNOUNCEMENT_ORDER_BY,
  compareAnnouncementsForDisplay,
} from "../src/features/announcements/lib/sorting";
import {
  projectLeadTagName,
  resolveProjectAnnouncementRecipientIds,
  uniqueAnnouncementRecipientIds,
} from "../src/features/announcements/lib/recipients";
import { ALL_TARGET_LABEL } from "../src/features/announcements/lib/target-copy";
import { PERMISSIONS } from "../src/shared/lib/permissions";

test("公告发布页应使用独立路由并复用创建权限", () => {
  assert.equal(ANNOUNCEMENT_LIST_ROUTE, "/announcements");
  assert.equal(ANNOUNCEMENT_CREATE_ROUTE, "/announcements/new");
  assert.equal(ANNOUNCEMENT_ENTITY_TYPE, "Announcement");
  assert.equal(ANNOUNCEMENT_CREATE_PERMISSION, PERMISSIONS.ANNOUNCEMENT_CREATE);
});

test("全员公告目标文案不应暴露 targetIds 底层结构", () => {
  assert.equal(ALL_TARGET_LABEL, "发送给全体成员");
  assert.equal(ALL_TARGET_LABEL.includes("targetIds"), false);
});

test("项目公告收件人应包含项目组长与成员、去重并排除发布者", () => {
  assert.equal(projectLeadTagName("project-1"), "project-lead:project-1");
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
