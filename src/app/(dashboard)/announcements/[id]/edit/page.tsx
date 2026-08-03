import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AnnouncementEditForm } from "@/features/announcements";
import { resolveAnnouncementUpdateAccess } from "@/features/announcements/lib/access";
import { buttonStyles } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
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
      <Link href={`/announcements/${announcement.id}`} className={buttonStyles({ variant: "ghost", size: "small", className: "-ml-3 w-fit" })}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        返回公告
      </Link>
      <PageHeader title="编辑公告" description="可修改标题、正文和展示属性；通知受众保持为发布时的范围。" />
      <StatusNotice title="通知范围">{targetLabels[announcement.targetType]}（编辑不会重复发送通知）</StatusNotice>
      <Card>
        <CardContent>
          <AnnouncementEditForm announcement={announcement} />
        </CardContent>
      </Card>
    </div>
  );
}
