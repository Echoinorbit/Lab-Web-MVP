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
  if (announcements.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed border-border bg-card px-6 py-12 text-center">
        <div className="text-[15px] font-medium">暂无公告</div>
        <p className="mt-1 text-sm text-muted-foreground">有新的实验室通知时会显示在这里。</p>
      </div>
    );
  }

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
