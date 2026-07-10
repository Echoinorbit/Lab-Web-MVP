import Link from "next/link";

import { AnnouncementList } from "@/features/announcements";
import { ANNOUNCEMENT_CREATE_ROUTE } from "@/features/announcements/lib/access";
import { ANNOUNCEMENT_ORDER_BY } from "@/features/announcements/lib/sorting";
import { buildAnnouncementVisibilityWhere, getAnnouncementVisibilityViewer } from "@/features/announcements/lib/visibility";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-4">
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
        />
        <Pagination basePath="/announcements" currentPage={pagination.currentPage} totalPages={pagination.totalPages} />
      </div>
      {permissions.has(PERMISSIONS.ANNOUNCEMENT_CREATE) ? (
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>公告发布</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={ANNOUNCEMENT_CREATE_ROUTE}
              className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              发布公告
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
