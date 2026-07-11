import { uniqueNotificationRecipientIds } from "@/features/notifications/lib/recipients";

export function uniqueAnnouncementRecipientIds(ids: readonly string[], authorId?: string) {
  return uniqueNotificationRecipientIds(ids, authorId);
}

export function resolveProjectAnnouncementRecipientIds({
  memberUserIds,
  leadUserIds,
  authorId,
}: {
  memberUserIds: readonly string[];
  leadUserIds: readonly string[];
  authorId: string;
}) {
  return uniqueAnnouncementRecipientIds([...leadUserIds, ...memberUserIds], authorId);
}
