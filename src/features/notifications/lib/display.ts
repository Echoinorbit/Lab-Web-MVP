import type { NotificationRelatedTypeName, NotificationTypeName } from "../types";

export const NOTIFICATION_TYPE_LABELS = {
  ANNOUNCEMENT_NEW: "公告",
  ANNOUNCEMENT_URGENT: "紧急公告",
  POST_COMMENT: "评论",
  PROJECT_NODE_NEW: "项目更新",
  PROJECT_STATUS: "项目状态",
  TAG_GRANTED: "Tag 授予",
  TAG_REQUEST: "Tag 申请",
  SYSTEM: "系统",
} as const satisfies Record<NotificationTypeName, string>;

export function getNotificationTypeLabel(type: NotificationTypeName, relatedType?: NotificationRelatedTypeName | null) {
  if (type === "TAG_GRANTED" && relatedType === "PROJECT") return "项目成员";
  return NOTIFICATION_TYPE_LABELS[type] ?? "通知";
}
