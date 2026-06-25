import { NotificationList } from "@/features/notifications";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

export default async function NotificationsPage() {
  const user = await requireActiveUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
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

  return (
    <NotificationList
      notifications={notifications.map((notification) => ({
        ...notification,
        content: notification.content ?? undefined,
        relatedType: notification.relatedType ?? undefined,
        senderName: notification.sender?.displayName,
        createdAt: notification.createdAt.toISOString().slice(0, 10),
      }))}
    />
  );
}
