import { AnnouncementCard } from "@/features/announcements";
import { buildAnnouncementVisibilityWhere, getAnnouncementVisibilityViewer } from "@/features/announcements/lib/visibility";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { notFound } from "next/navigation";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireActiveUser();
  const now = new Date();
  const viewer = await getAnnouncementVisibilityViewer(user, now);
  const announcement = await prisma.announcement.findFirst({
    where: {
      id,
      AND: [buildAnnouncementVisibilityWhere(viewer, now)],
    },
    include: { author: { select: { displayName: true } } },
  });

  if (!announcement) notFound();

  return (
    <AnnouncementCard
      announcement={{
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        authorName: announcement.author.displayName,
        createdAt: formatDate(announcement.createdAt),
        isPinned: announcement.isPinned,
        isUrgent: announcement.isUrgent,
      }}
    />
  );
}
