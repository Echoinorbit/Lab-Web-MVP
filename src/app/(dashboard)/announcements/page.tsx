import { Plus } from "lucide-react";
import Link from "next/link";

import { AnnouncementList } from "@/features/announcements";
import { ANNOUNCEMENT_CREATE_ROUTE } from "@/features/announcements/lib/access";
import { ANNOUNCEMENT_ORDER_BY } from "@/features/announcements/lib/sorting";
import { buildAnnouncementVisibilityWhere, getAnnouncementVisibilityViewer } from "@/features/announcements/lib/visibility";
import { buttonStyles } from "@/shared/components/ui/button";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
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
    include: { author: { select: { displayName: true } } },
  });
  const canCreate = permissions.has(PERMISSIONS.ANNOUNCEMENT_CREATE);

  return (
    <div className="space-y-8">
      <PageHeader
        title="公告"
        description="实验室重要通知按置顶、紧急程度与发布时间排序。"
        actions={canCreate ? (
          <Link href={ANNOUNCEMENT_CREATE_ROUTE} className={buttonStyles()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            发布公告
          </Link>
        ) : null}
      />
      <AnnouncementList
        announcements={announcements.map((announcement) => ({
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          authorName: announcement.author.displayName,
          createdAt: formatShanghaiDate(announcement.createdAt),
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
