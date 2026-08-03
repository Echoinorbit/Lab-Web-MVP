import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AnnouncementCard } from "@/features/announcements";
import { buildAnnouncementVisibilityWhere, getAnnouncementVisibilityViewer } from "@/features/announcements/lib/visibility";
import { resolveAnnouncementUpdateAccess } from "@/features/announcements/lib/access";
import { buttonStyles } from "@/shared/components/ui/button";
import { formatActorDisplayName, resolveActorDisplay } from "@/shared/lib/actor-snapshot";
import { formatShanghaiDate } from "@/shared/lib/date";
import { prisma } from "@/shared/lib/prisma";
import { getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { requireActiveUser } from "@/shared/lib/session";

export default async function AnnouncementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireActiveUser();
  const now = new Date();
  const [viewer, permissions] = await Promise.all([
    getAnnouncementVisibilityViewer(user, now),
    getUserPermissions(user.id),
  ]);
  const announcement = await prisma.announcement.findFirst({
    where: {
      id,
      AND: [buildAnnouncementVisibilityWhere(viewer, now)],
    },
    include: { author: { select: { displayName: true, status: true } } },
  });

  if (!announcement) notFound();
  const canEdit = resolveAnnouncementUpdateAccess({
    actorId: user.id,
    actorRole: user.role,
    authorId: announcement.authorId,
    permissions,
  }).allowed;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href="/announcements" className={buttonStyles({ variant: "ghost", size: "small", className: "-ml-3 w-fit" })}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        返回公告
      </Link>
      <AnnouncementCard
        announcement={{
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          authorName: formatActorDisplayName(resolveActorDisplay(announcement.author, announcement.authorSnapshot)),
          createdAt: formatShanghaiDate(announcement.createdAt),
          updatedAt: announcement.updatedAt.getTime() > announcement.createdAt.getTime()
            ? formatShanghaiDate(announcement.updatedAt)
            : null,
          isPinned: announcement.isPinned,
          isUrgent: announcement.isUrgent,
        }}
        canEdit={canEdit}
        canDelete={permissions.has(PERMISSIONS.ANNOUNCEMENT_DELETE)}
      />
    </div>
  );
}
