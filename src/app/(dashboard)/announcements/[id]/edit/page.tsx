import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AnnouncementEditForm } from "@/features/announcements";
import { resolveAnnouncementUpdateAccess } from "@/features/announcements/lib/access";
import { PageHeader } from "@/shared/components/ui/page-header";
import { StatusNotice } from "@/shared/components/ui/status-notice";
import { getUserPermissions } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireActiveUser();
  const [announcement, permissions] = await Promise.all([
    prisma.announcement.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        authorId: true,
        title: true,
        content: true,
        isUrgent: true,
        isPinned: true,
        targetType: true,
      },
    }),
    getUserPermissions(user.id),
  ]);
  if (!announcement) notFound();
  const access = resolveAnnouncementUpdateAccess({
    actorId: user.id,
    actorRole: user.role,
    authorId: announcement.authorId,
    permissions,
  });
  if (!access.allowed) redirect("/403");

  const targetLabels = { ALL: "全体成员", PROJECT: "指定项目", TAG: "指定 Tag", USERS: "指定成员" } as const;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href={`/announcements/${announcement.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        返回公告
      </Link>
      <PageHeader title="编辑公告" description="可修改标题、正文和展示属性；通知受众保持为发布时的范围。" />
      <StatusNotice title="通知范围">{targetLabels[announcement.targetType]}（编辑不会重复发送通知）</StatusNotice>
      <div className="rounded-2xl border border-border/90 bg-card p-5 sm:p-7">
        <AnnouncementEditForm announcement={announcement} />
      </div>
    </div>
  );
}
