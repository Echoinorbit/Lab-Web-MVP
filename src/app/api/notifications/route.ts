import { NextResponse } from "next/server";

import { buildNotificationReadUpdate, notificationReadStateSchema } from "@/features/notifications/lib/read-state";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

export async function GET() {
  const user = await requireActiveUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      content: true,
      isRead: true,
      createdAt: true,
      type: true,
      relatedId: true,
      relatedType: true,
      sender: { select: { displayName: true } },
    },
  });

  return NextResponse.json(
    notifications.map(({ sender, ...notification }) => ({
      ...notification,
      relatedType: notification.relatedType ?? undefined,
      senderName: sender?.displayName,
      createdAt: notification.createdAt.toISOString(),
    })),
  );
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
