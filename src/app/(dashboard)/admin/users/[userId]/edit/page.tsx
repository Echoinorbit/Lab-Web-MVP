import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { UserEditor } from "@/features/admin";
import { buttonStyles } from "@/shared/components/ui/button";
import { PageHeader } from "@/shared/components/ui/page-header";
import { requirePermission } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDate(value: Date | null) {
  return value ? dateFormatter.format(value) : null;
}

export default async function AdminUserEditPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const actor = await requirePermission({
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: userId,
  });
  const now = new Date();
  const [user, advisors] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        studentId: true,
        role: true,
        status: true,
        studyDegree: true,
        studyGrade: true,
        identityNeedsReview: true,
        advisorId: true,
        graduatedAt: true,
        scheduledDeletionAt: true,
        createdAt: true,
        updatedAt: true,
        tags: {
          where: {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            source: true,
            tag: { select: { name: true, displayName: true, scope: true } },
            project: { select: { name: true } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        role: "MEMBER",
        status: "ACTIVE",
        studyDegree: "MENTOR",
        identityNeedsReview: false,
      },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, username: true },
    }),
  ]);
  if (!user) notFound();

  return (
    <div className="min-w-0 space-y-8">
      <PageHeader
        title={`管理 ${user.displayName}`}
        description="基础资料、系统角色、培养身份与生命周期分别保存；每次高风险操作都需要明确确认。"
        actions={(
          <Link href="/admin/users" className={buttonStyles({ variant: "secondary" })}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回用户列表
          </Link>
        )}
      />
      <UserEditor
        key={user.updatedAt.toISOString()}
        isCurrentUser={actor.id === user.id}
        advisors={advisors}
        user={{
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          studentId: user.studentId,
          role: user.role,
          status: user.status,
          studyDegree: user.studyDegree,
          studyGrade: user.studyGrade,
          identityNeedsReview: user.identityNeedsReview,
          advisorId: user.advisorId,
          graduatedAt: formatDate(user.graduatedAt),
          scheduledDeletionAt: formatDate(user.scheduledDeletionAt),
          createdAt: formatDate(user.createdAt) ?? "-",
          updatedAt: formatDate(user.updatedAt) ?? "-",
          tags: user.tags.map((userTag) => ({
            id: userTag.id,
            name: userTag.tag.name,
            displayName: userTag.tag.displayName,
            source: userTag.source,
            scope: userTag.tag.scope,
            projectName: userTag.project?.name ?? null,
          })),
        }}
      />
    </div>
  );
}
