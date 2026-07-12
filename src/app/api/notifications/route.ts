import { NextResponse } from "next/server";

import { buildNotificationReadUpdate, notificationReadStateSchema } from "@/features/notifications/lib/read-state";
import { NOTIFICATIONS_PAGE_SIZE } from "@/features/notifications/lib/pagination";
import { formatActorDisplayName, resolveActorDisplay } from "@/shared/lib/actor-snapshot";
import { formatShanghaiDateTime } from "@/shared/lib/date";
import { getPaginationState, parsePageParam } from "@/shared/lib/pagination";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

export async function GET(request: Request) {
  const user = await requireActiveUser();
  const requestedPage = parsePageParam(new URL(request.url).searchParams.get("page") ?? undefined);
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
      isRead: true,
      createdAt: true,
      type: true,
      relatedId: true,
      relatedType: true,
      sender: { select: { displayName: true, status: true } },
      senderSnapshot: true,
    },
  });

  return NextResponse.json({
    items: notifications.map(({ sender, senderSnapshot, ...notification }) => ({
      ...notification,
      relatedType: notification.relatedType ?? undefined,
      senderName: formatActorDisplayName(resolveActorDisplay(sender, senderSnapshot)),
      createdAt: formatShanghaiDateTime(notification.createdAt),
    })),
    page: pagination.currentPage,
    pageSize: pagination.pageSize,
    total,
    totalPages: pagination.totalPages,
    unreadCount,
  });
}

export async function PATCH(request: Request) {
  const user = await requireActiveUser();
  const parsed = notificationReadStateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid notification read state." }, { status: 400 });
  }

  await prisma.notification.updateMany(buildNotificationReadUpdate(user.id, parsed.data));

  return NextResponse.json({ ok: true });
}
