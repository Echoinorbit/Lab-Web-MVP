import Link from "next/link";
import type { Route } from "next";

import { AnnouncementList } from "@/features/announcements";
import { ANNOUNCEMENT_ORDER_BY } from "@/features/announcements/lib/sorting";
import { buildAnnouncementVisibilityWhere, getAnnouncementVisibilityViewer } from "@/features/announcements/lib/visibility";
import { ProjectList } from "@/features/projects";
import { canViewProject, getProjectVisibilityWhere } from "@/features/projects/lib/visibility";
import { SummaryTable, type ProgressSummaryRow } from "@/features/progress";
import { getProgressAudienceWhere } from "@/features/progress/lib/advisor-filter";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { formatShanghaiDate, getShanghaiDateParts } from "@/shared/lib/date";
import { getEffectiveTags, getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

export default async function DashboardPage() {
  const user = await requireActiveUser();
  const [permissions, effectiveTags] = await Promise.all([getUserPermissions(user.id), getEffectiveTags(user.id)]);
  const canReadAllProgress = permissions.has(PERMISSIONS.PROGRESS_REPORT_READ_ALL);
  const canReadAdviseeProgress = permissions.has(PERMISSIONS.PROGRESS_REPORT_READ_ADVISEES);
  const { year, month } = getShanghaiDateParts();
  const projectVisibilityWhere = getProjectVisibilityWhere({ id: user.id, role: user.role, tags: effectiveTags });
  const announcementVisibilityViewer = await getAnnouncementVisibilityViewer(user);
  const announcementWhere = buildAnnouncementVisibilityWhere(announcementVisibilityViewer);
  const projectViewer = { id: user.id, role: user.role, tags: effectiveTags };
  const progressAudienceWhere = getProgressAudienceWhere({
    userId: user.id,
    canReadAll: canReadAllProgress,
    canReadAdvisees: canReadAdviseeProgress,
  });

  const [
    memberCount,
    projectCount,
    announcementCount,
    unreadNotificationCount,
    announcements,
    projects,
    progressMembers,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "MEMBER", status: "ACTIVE" } }),
    prisma.project.count({ where: projectVisibilityWhere }),
    prisma.announcement.count({ where: announcementWhere }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    prisma.announcement.findMany({
      where: announcementWhere,
      orderBy: ANNOUNCEMENT_ORDER_BY,
      take: 5,
      include: { author: { select: { displayName: true } } },
    }),
    prisma.project.findMany({
      where: projectVisibilityWhere,
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        members: { select: { userId: true } },
        _count: {
          select: {
            members: true,
            nodes: { where: { deletedAt: null } },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: progressAudienceWhere,
      orderBy: [{ grade: "asc" }, { studentId: "asc" }, { displayName: "asc" }],
      take: canReadAllProgress || canReadAdviseeProgress ? 8 : 1,
      include: {
        advisor: { select: { displayName: true } },
        progressReports: {
          where: { year, month, deletedAt: null },
          select: { status: true },
          take: 1,
        },
      },
    }),
  ]);

  const progressRows: ProgressSummaryRow[] = progressMembers.map((member) => ({
    studentName: member.displayName,
    studentId: member.studentId ?? "-",
    advisorName: member.advisor?.displayName ?? "-",
    grade: member.grade ?? "-",
    status: member.progressReports[0]?.status ?? "MISSING",
  }));
  const metrics: Array<{ label: string; value: number; href?: Route }> = [
    {
      label: "活跃成员",
      value: memberCount,
      href: permissions.has(PERMISSIONS.ADMIN_USER_MANAGE) ? "/admin/users" : undefined,
    },
    { label: "可见项目", value: projectCount, href: "/projects" },
    { label: "有效公告", value: announcementCount, href: "/announcements" },
    { label: "未读通知", value: unreadNotificationCount, href: "/notifications" },
  ];

  return (
    <div className="space-y-10 sm:space-y-12">
      <PageHeader title="协作总览" description="快速掌握实验室正在推进的项目、重要公告、个人通知与本月进度。" />

      <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border/90 bg-card md:grid-cols-4">
        {metrics.map((metric) => {
          const content = (
            <div className="flex min-h-28 flex-col justify-between p-5 sm:min-h-32 sm:p-6">
              <dt className="text-sm text-muted-foreground">{metric.label}</dt>
              <dd className="mt-5 text-[32px] font-semibold tabular-nums tracking-[-0.04em]">{metric.value}</dd>
            </div>
          );

          return metric.href ? (
            <Link
              key={metric.label}
              href={metric.href}
              aria-label={`${metric.label}：${metric.value}`}
              className="border-b border-r border-border/75 transition-colors hover:bg-muted/45 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:border-b-0"
            >
              {content}
            </Link>
          ) : (
            <div key={metric.label} className="border-b border-r border-border/75 md:border-b-0">
              {content}
            </div>
          );
        })}
      </dl>

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-10 xl:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)] xl:gap-12">
        <div className="min-w-0 space-y-10">
          <section className="space-y-5">
            <SectionHeader
              title="最新公告"
              description="按置顶与紧急程度优先显示。"
              actions={(
                <Link href="/announcements" className="text-sm font-medium text-primary transition-colors hover:text-primary/80">
                查看全部
                  <span className="ml-1" aria-hidden="true">›</span>
                </Link>
              )}
            />
            <AnnouncementList
              announcements={announcements.map((announcement) => ({
                id: announcement.id,
                title: announcement.title,
                content: announcement.content,
                authorName: announcement.author.displayName,
                createdAt: formatShanghaiDate(announcement.createdAt),
                isPinned: announcement.isPinned,
                isUrgent: announcement.isUrgent,
              }))}
              linkToDetail
            />
          </section>

          <section className="space-y-5">
            <SectionHeader
              title="最近项目"
              description="按最近更新时间排列。"
              actions={(
                <Link href="/projects" className="text-sm font-medium text-primary transition-colors hover:text-primary/80">
                查看全部
                  <span className="ml-1" aria-hidden="true">›</span>
                </Link>
              )}
            />
            <ProjectList
              projects={projects.map((project) => ({
                id: project.id,
                name: project.name,
                status: project.status,
                memberCount: project._count.members,
                nodeCount: project._count.nodes,
                description: project.description,
                canPreview: canViewProject(projectViewer, project),
              }))}
            />
          </section>
        </div>

        <section className="min-w-0 space-y-5 xl:sticky xl:top-24">
          <SectionHeader title="本月进度" description={`${year} 年 ${month} 月提交状态`} />
          <SummaryTable rows={progressRows} />
        </section>
      </section>
    </div>
  );
}
