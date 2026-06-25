import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNotificationReadUpdate,
  notificationReadStateSchema,
} from "../src/features/notifications/lib/read-state";
import {
  shouldNotifyRecipient,
  uniqueNotificationRecipientIds,
} from "../src/features/notifications/lib/recipients";

test("通知收件人应排除触发者自己", () => {
  assert.equal(shouldNotifyRecipient("actor", "actor"), false);
  assert.equal(shouldNotifyRecipient("actor", "recipient"), true);
});

test("通知收件人列表应去重并排除触发者自己", () => {
  assert.deepEqual(uniqueNotificationRecipientIds(["u1", "actor", "u1", "u2"], "actor"), ["u1", "u2"]);
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
