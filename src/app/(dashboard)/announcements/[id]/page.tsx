import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnnouncementCard } from "@/features/announcements";
import { buildAnnouncementVisibilityWhere, getAnnouncementVisibilityViewer } from "@/features/announcements/lib/visibility";
import { resolveActorDisplay } from "@/shared/lib/actor-snapshot";
import { formatShanghaiDate } from "@/shared/lib/date";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

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
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href="/announcements" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        返回公告
      </Link>
      <AnnouncementCard
        announcement={{
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          authorName: resolveActorDisplay(announcement.author, announcement.authorSnapshot).displayName,
          createdAt: formatShanghaiDate(announcement.createdAt),
          isPinned: announcement.isPinned,
          isUrgent: announcement.isUrgent,
        }}
      />
    </div>
  );
}
