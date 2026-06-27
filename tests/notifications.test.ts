import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNotificationReadUpdate,
  notificationReadStateSchema,
} from "../src/features/notifications/lib/read-state";
import { getNotificationTypeLabel } from "../src/features/notifications/lib/display";
import {
  mergeAdminNotificationRecipientIds,
  shouldNotifyRecipient,
  uniqueNotificationRecipientIds,
} from "../src/features/notifications/lib/recipients";
import { NOTIFICATIONS_PAGE_SIZE } from "../src/features/notifications/lib/pagination";

test("通知收件人应排除触发者自己", () => {
  assert.equal(shouldNotifyRecipient("actor", "actor"), false);
  assert.equal(shouldNotifyRecipient("actor", "recipient"), true);
});

test("通知收件人列表应去重并排除触发者自己", () => {
  assert.deepEqual(uniqueNotificationRecipientIds(["u1", "actor", "u1", "u2"], "actor"), ["u1", "u2"]);
});

test("领域收件人应自动合并有效管理员、去重并排除触发者", () => {
  assert.deepEqual(
    mergeAdminNotificationRecipientIds({
      recipientIds: ["member-1", "admin-1", "member-1"],
      adminIds: ["admin-1", "admin-2", "actor"],
      actorId: "actor",
    }),
    ["member-1", "admin-1", "admin-2"],
  );
});

test("通知分页固定为每页 5 条", () => {
  assert.equal(NOTIFICATIONS_PAGE_SIZE, 5);
});

test("通知标已读应支持单条和显式全部未读通知", () => {
  const now = new Date("2026-06-25T07:30:00.000Z");
  assert.equal(notificationReadStateSchema.safeParse({}).success, false);
  assert.equal(notificationReadStateSchema.safeParse({ read: true }).success, true);
  assert.equal(notificationReadStateSchema.safeParse({ id: "n1", read: true, unexpected: "x" }).success, false);
  assert.deepEqual(buildNotificationReadUpdate("user-1", { id: "n1", read: true }, now), {
    where: { userId: "user-1", id: "n1" },
    data: { isRead: true, readAt: now },
  });
  assert.deepEqual(buildNotificationReadUpdate("user-1", notificationReadStateSchema.parse({ read: true }), now), {
    where: { userId: "user-1", isRead: false },
    data: { isRead: true, readAt: now },
  });
});

test("通知标未读必须限定单条本人通知", () => {
  assert.equal(notificationReadStateSchema.safeParse({ read: false }).success, false);
  assert.deepEqual(
    buildNotificationReadUpdate("user-1", notificationReadStateSchema.parse({ id: "n1", read: false })),
    {
      where: { userId: "user-1", id: "n1" },
      data: { isRead: false, readAt: null },
    },
  );
});

test("通知类型应映射为中文标签", () => {
  assert.equal(getNotificationTypeLabel("ANNOUNCEMENT_URGENT"), "紧急公告");
  assert.equal(getNotificationTypeLabel("POST_COMMENT"), "评论");
  assert.equal(getNotificationTypeLabel("TAG_GRANTED"), "Tag 授予");
  assert.equal(getNotificationTypeLabel("TAG_GRANTED", "PROJECT"), "项目成员");
});
