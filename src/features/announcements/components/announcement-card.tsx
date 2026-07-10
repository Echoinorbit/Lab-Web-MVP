import Link from "next/link";

import { MarkdownRenderer } from "@/shared/components/markdown-renderer";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

import type { AnnouncementSummary } from "../types";
import { AnnouncementDeleteButton } from "./announcement-delete-button";

export function AnnouncementCard({
  announcement,
  canDelete = false,
  linkToDetail = false,
}: {
  announcement: AnnouncementSummary;
  canDelete?: boolean;
  linkToDetail?: boolean;
}) {
  const titleClassName = cn(
    "font-semibold leading-tight tracking-[-0.028em]",
    linkToDetail ? "text-xl sm:text-2xl" : "text-[32px] sm:text-[40px]",
  );

  return (
    <article
      data-announcement-row
      className={cn(
        linkToDetail
          ? "px-5 py-6 transition-colors duration-[var(--motion-fast)] hover:bg-muted/45 sm:px-6"
          : "mx-auto max-w-4xl py-2",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {announcement.isPinned ? <Badge className="bg-secondary">置顶</Badge> : null}
          {announcement.isUrgent ? <Badge className="border-destructive/30 bg-destructive/10 text-destructive">紧急</Badge> : null}
          <span>{announcement.authorName}</span>
          <span aria-hidden="true">·</span>
          <time>{announcement.createdAt}</time>
        </div>
        {canDelete ? <AnnouncementDeleteButton announcementId={announcement.id} /> : null}
      </div>

      {linkToDetail ? (
        <h2 className={cn(titleClassName, "mt-4")}>
          <Link
            href={`/announcements/${announcement.id}`}
            className="rounded-sm transition-colors duration-[var(--motion-fast)] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {announcement.title}
          </Link>
        </h2>
      ) : (
        <h1 className={cn(titleClassName, "mt-5")}>{announcement.title}</h1>
      )}

      <div className={cn("mt-5", linkToDetail && "max-h-28 overflow-hidden text-muted-foreground")}>
        <MarkdownRenderer content={announcement.content} />
      </div>

      {linkToDetail ? (
        <Link href={`/announcements/${announcement.id}`} className="mt-5 inline-flex text-sm font-medium text-primary hover:text-primary/80">
          阅读全文 <span className="ml-1" aria-hidden="true">›</span>
        </Link>
      ) : null}
    </article>
  );
}
