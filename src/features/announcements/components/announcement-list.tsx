import { AnnouncementCard } from "./announcement-card";
import type { AnnouncementSummary } from "../types";

export function AnnouncementList({
  announcements,
  canDelete = false,
  linkToDetail = false,
}: {
  announcements: readonly AnnouncementSummary[];
  canDelete?: boolean;
  linkToDetail?: boolean;
}) {
  return (
    <div className="space-y-3">
      {announcements.map((announcement) => (
        <AnnouncementCard
          key={announcement.id}
          announcement={announcement}
          canDelete={canDelete}
          linkToDetail={linkToDetail}
        />
      ))}
    </div>
  );
}
