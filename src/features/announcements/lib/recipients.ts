import { uniqueNotificationRecipientIds } from "@/features/notifications/lib/recipients";
import { PROJECT_LEAD_TAG_PREFIX } from "@/shared/lib/system-tags";

export function projectLeadTagName(projectId: string) {
  return `${PROJECT_LEAD_TAG_PREFIX}:${projectId}`;
}

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
