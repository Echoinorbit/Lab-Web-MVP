import { Plus } from "lucide-react";
import Link from "next/link";

import { AnnouncementList } from "@/features/announcements";
import { ANNOUNCEMENT_CREATE_ROUTE } from "@/features/announcements/lib/access";
import { summarizeAnnouncementContent } from "@/features/announcements/lib/preview";
import { ANNOUNCEMENT_ORDER_BY } from "@/features/announcements/lib/sorting";
import { buildAnnouncementVisibilityWhere, getAnnouncementVisibilityViewer } from "@/features/announcements/lib/visibility";
import { buttonStyles } from "@/shared/components/ui/button";
import { Pagination } from "@/shared/components/ui/pagination";
import { formatActorDisplayName, resolveActorDisplay } from "@/shared/lib/actor-snapshot";
import { formatShanghaiDate } from "@/shared/lib/date";
import { getPaginationState, parsePageParam } from "@/shared/lib/pagination";
import { getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

const ANNOUNCEMENTS_PAGE_SIZE = 10;

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const requestedPage = parsePageParam((await searchParams).page);
  const user = await requireActiveUser();
  const now = new Date();
  const permissions = await getUserPermissions(user.id);
  const announcementViewer = await getAnnouncementVisibilityViewer(user, now);
  const announcementWhere = buildAnnouncementVisibilityWhere(announcementViewer, now);
  const totalAnnouncements = await prisma.announcement.count({ where: announcementWhere });
  const pagination = getPaginationState({
    page: requestedPage,
    totalItems: totalAnnouncements,
    pageSize: ANNOUNCEMENTS_PAGE_SIZE,
  });
  const announcements = await prisma.announcement.findMany({
    where: announcementWhere,
    orderBy: ANNOUNCEMENT_ORDER_BY,
    skip: pagination.skip,
    take: pagination.pageSize,
    include: { author: { select: { displayName: true, status: true } } },
  });
  const canCreate = permissions.has(PERMISSIONS.ANNOUNCEMENT_CREATE);

  return (
    <div>
      <header className="flex min-h-[16rem] items-end justify-between gap-8 bg-foreground px-8 py-8 text-background portrait:min-h-[20rem] portrait:flex-col portrait:items-start portrait:justify-end portrait:px-6">
        <div>
          <p className="font-mono text-[.875rem] uppercase tracking-[.12em] text-background/60">// announcement board</p>
          <h1 className="mt-4 font-bold text-[3rem] leading-none">公告</h1>
          <p className="mt-4 max-w-[36rem] text-[1.125rem] leading-7 text-background/72">实验室重要通知按置顶、紧急程度与发布时间排序。</p>
        </div>
        {canCreate ? (
          <Link href={ANNOUNCEMENT_CREATE_ROUTE} className={buttonStyles({ className: "rounded-none font-mono text-[.8125rem] uppercase tracking-[.04em]" })}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            发布公告
          </Link>
        ) : null}
      </header>
      <AnnouncementList
        announcements={announcements.map((announcement) => ({
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          summary: summarizeAnnouncementContent(announcement.content),
          authorName: formatActorDisplayName(resolveActorDisplay(announcement.author, announcement.authorSnapshot)),
          createdAt: formatShanghaiDate(announcement.createdAt),
          updatedAt: announcement.updatedAt.getTime() > announcement.createdAt.getTime()
            ? formatShanghaiDate(announcement.updatedAt)
            : null,
          isPinned: announcement.isPinned,
          isUrgent: announcement.isUrgent,
        }))}
        canDelete={permissions.has(PERMISSIONS.ANNOUNCEMENT_DELETE)}
        linkToDetail
      />
      <Pagination basePath="/announcements" currentPage={pagination.currentPage} totalPages={pagination.totalPages} />
    </div>
  );
}
