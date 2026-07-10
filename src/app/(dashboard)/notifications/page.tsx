import { NotificationList } from "@/features/notifications";
import { NOTIFICATIONS_PAGE_SIZE } from "@/features/notifications/lib/pagination";
import { Pagination } from "@/shared/components/ui/pagination";
import { formatShanghaiDateTime } from "@/shared/lib/date";
import { getPaginationState, parsePageParam } from "@/shared/lib/pagination";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireActiveUser();
  const requestedPage = parsePageParam((await searchParams).page);
  const [total, unreadCount] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id } }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
  ]);
  const pagination = getPaginationState({
    page: requestedPage,
    totalItems: total,
    pageSize: NOTIFICATIONS_PAGE_SIZE,
  });
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    skip: pagination.skip,
    take: pagination.pageSize,
    select: {
      id: true,
      title: true,
      content: true,
      type: true,
      relatedType: true,
      sender: { select: { displayName: true } },
      createdAt: true,
      isRead: true,
    },
  });

  const pageData = {
    items: notifications.map((notification) => ({
      ...notification,
      content: notification.content ?? undefined,
      relatedType: notification.relatedType ?? undefined,
      senderName: notification.sender?.displayName,
      createdAt: formatShanghaiDateTime(notification.createdAt),
    })),
    page: pagination.currentPage,
    pageSize: pagination.pageSize,
    total,
    totalPages: pagination.totalPages,
    unreadCount,
  };

  return (
    <div className="space-y-6">
      <NotificationList pageData={pageData} />
      <Pagination basePath="/notifications" currentPage={pagination.currentPage} totalPages={pagination.totalPages} />
    </div>
  );
}
