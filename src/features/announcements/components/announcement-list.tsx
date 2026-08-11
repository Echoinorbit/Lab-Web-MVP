import type { AnnouncementSummary } from "../types";
import { AnnouncementCard } from "./announcement-card";

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
      <div className="border-y border-dashed border-border px-8 py-20 text-center font-mono text-[.875rem] uppercase tracking-[.05em] text-muted-foreground portrait:px-6">
        // 暂无公告。新的实验室通知会按置顶、紧急程度与时间显示在这里。
      </div>
    );
  }

  return (
    <div className="border-y border-border bg-card">
      {announcements.map((announcement) => (
        <AnnouncementCard
          key={announcement.id}
          announcement={announcement}
          canDelete={canDelete}
          linkToDetail={linkToDetail}
          className="border-b border-border last:border-b-0"
        />
      ))}
    </div>
  );
}
