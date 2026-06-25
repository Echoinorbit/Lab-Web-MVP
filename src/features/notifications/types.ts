export type NotificationTypeName =
  | "ANNOUNCEMENT_NEW"
  | "ANNOUNCEMENT_URGENT"
  | "POST_COMMENT"
  | "PROJECT_NODE_NEW"
  | "PROJECT_STATUS"
  | "TAG_GRANTED"
  | "TAG_REQUEST"
  | "SYSTEM";

export type NotificationRelatedTypeName = "POST" | "PROJECT" | "ANNOUNCEMENT" | string;

export type NotificationRow = {
  id: string;
  type: NotificationTypeName;
  relatedType?: NotificationRelatedTypeName;
  title: string;
  content?: string;
  senderName?: string;
  createdAt: string;
  isRead: boolean;
};
