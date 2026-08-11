import { Pencil } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { MarkdownRenderer } from "@/shared/components/markdown-renderer";
import { buttonStyles } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import type { AnnouncementSummary } from "../types";
import { AnnouncementDeleteButton } from "./announcement-delete-button";

export function AnnouncementCard({
  announcement,
  canDelete = false,
  canEdit = false,
  linkToDetail = false,
  className,
}: {
  announcement: AnnouncementSummary;
  canDelete?: boolean;
  canEdit?: boolean;
  linkToDetail?: boolean;
  className?: string;
}) {
  const titleClassName = cn(
    "font-ui-medium leading-tight",
    linkToDetail ? "text-[1.75rem] portrait:text-[1.375rem]" : "text-[2.5rem] portrait:text-[2rem]",
  );

  return (
    <article
      data-announcement-row
      className={cn(
        linkToDetail
          ? "relative px-8 py-7 transition-colors duration-[var(--motion-fast)] hoverable:hover:bg-surface-raised portrait:px-6"
          : "mx-auto max-w-4xl border-y border-border py-8 portrait:px-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 font-ui-medium text-[.8125rem] tracking-[.04em] text-muted-foreground">
          {announcement.isPinned ? <span className="text-foreground">// 置顶</span> : null}
          {announcement.isUrgent ? <span className="text-destructive">// 紧急</span> : null}
          <span className="hidden sm:inline">发布 {announcement.authorName}</span>
          <time>{announcement.createdAt}</time>
          {announcement.updatedAt ? (
            <time className="hidden md:inline">已编辑 {announcement.updatedAt}</time>
          ) : null}
        </div>
        {canEdit || canDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? (
              <Link href={`/announcements/${announcement.id}/edit` as Route} className={buttonStyles({ variant: "ghost", size: "small", className: "rounded-none font-mono text-[.8125rem] uppercase tracking-[.04em]" })}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                编辑
              </Link>
            ) : null}
            {canDelete ? <AnnouncementDeleteButton announcementId={announcement.id} returnToList={!linkToDetail} /> : null}
          </div>
        ) : null}
      </div>

      {linkToDetail ? (
        <h2 className={cn(titleClassName, "mt-4")}>
          <Link
            href={`/announcements/${announcement.id}`}
            className="rounded-sm transition-colors duration-[var(--motion-fast)] hoverable:hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {announcement.title}
          </Link>
        </h2>
      ) : (
        <h1 className={cn(titleClassName, "mt-5")}>{announcement.title}</h1>
      )}

      {linkToDetail ? (
        <p className="mt-5 line-clamp-3 max-w-[72ch] text-[1rem] leading-7 text-muted-foreground">
          {announcement.summary ?? "暂无内容"}
        </p>
      ) : (
        <div className="mt-5">
          <MarkdownRenderer content={announcement.content} />
        </div>
      )}

      {linkToDetail ? (
        <Link href={`/announcements/${announcement.id}`} className="mt-5 inline-flex font-mono text-[.8125rem] uppercase tracking-[.04em] text-foreground transition-colors hoverable:hover:text-primary">
          // 阅读全文 <span className="ml-1" aria-hidden="true">›</span>
        </Link>
      ) : null}
    </article>
  );
}
