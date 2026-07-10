import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { MarkdownRenderer } from "@/shared/components/markdown-renderer";

import { AnnouncementDeleteButton } from "./announcement-delete-button";
import type { AnnouncementSummary } from "../types";

export function AnnouncementCard({
  announcement,
  canDelete = false,
  linkToDetail = false,
}: {
  announcement: AnnouncementSummary;
  canDelete?: boolean;
  linkToDetail?: boolean;
}) {
  return (
    <Card data-announcement-row className={linkToDetail ? "transition-[border-color,background-color] duration-200 hover:border-foreground/20 hover:bg-muted/25" : undefined}>
      <CardHeader className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {announcement.isPinned ? <Badge className="bg-secondary">置顶</Badge> : null}
            {announcement.isUrgent ? <Badge className="bg-destructive text-destructive-foreground">紧急</Badge> : null}
            <span className="text-xs leading-5 tabular-nums text-muted-foreground">
              {announcement.authorName} · {announcement.createdAt}
            </span>
          </div>
          {canDelete ? <AnnouncementDeleteButton announcementId={announcement.id} /> : null}
        </div>
        <CardTitle className="leading-6">
          {linkToDetail ? (
            <Link href={`/announcements/${announcement.id}`} className="transition-colors hover:text-primary">
              {announcement.title}
            </Link>
          ) : (
            announcement.title
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <MarkdownRenderer content={announcement.content} />
      </CardContent>
    </Card>
  );
}
