import { Megaphone } from "lucide-react";

import { EmptyState } from "@/shared/components/ui/empty-state";

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
      <EmptyState
        icon={<Megaphone className="h-5 w-5" aria-hidden="true" />}
        title="暂无公告"
        description="新的实验室通知发布后，会按置顶、紧急程度与时间显示在这里。"
      />
    );
  }

  return (
    <div className="divide-y divide-border/65 overflow-hidden rounded-3xl border border-white/60 bg-card shadow-[var(--shadow-surface)] dark:border-border/80">
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
