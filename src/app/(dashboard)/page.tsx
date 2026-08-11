import Link from "next/link";
import type { Route } from "next";
import AdminPage from "./admin/page";
import AnnouncementsPage from "./announcements/page";
import NotificationsPage from "./notifications/page";
import PostsPage from "./posts/page";
import ProfilePage from "./profile/page";
import ProgressPage from "./progress/page";
import ProjectsPage from "./projects/page";

import { AnnouncementList } from "@/features/announcements";
import { summarizeAnnouncementContent } from "@/features/announcements/lib/preview";
import { ANNOUNCEMENT_ORDER_BY } from "@/features/announcements/lib/sorting";
import { buildAnnouncementVisibilityWhere, getAnnouncementVisibilityViewer } from "@/features/announcements/lib/visibility";
import { ProjectList } from "@/features/projects";
import { getProjectVisibilityWhere } from "@/features/projects/lib/visibility";
import { SummaryTable, type ProgressSummaryRow } from "@/features/progress";
import { getProgressAudienceWhere } from "@/features/progress/lib/advisor-filter";
import { DashboardHome } from "@/shared/components/endfield/dashboard-home";
import { SectionHeader } from "@/shared/components/ui/page-header";
import { formatActorDisplayName, resolveActorDisplay } from "@/shared/lib/actor-snapshot";
import { formatShanghaiDate, getShanghaiDateParts } from "@/shared/lib/date";
import { buildNavigationAccess } from "@/shared/lib/navigation-access";
import { getEffectiveTags, getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { formatStudyGrade } from "@/shared/lib/study-identity";

export default async function DashboardPage() {
  const user = await requireActiveUser();
  const [permissions, effectiveTags] = await Promise.all([getUserPermissions(user.id), getEffectiveTags(user.id)]);
  const navigationAccess = buildNavigationAccess(permissions);
  const canReadAllProgress = permissions.has(PERMISSIONS.PROGRESS_REPORT_READ_ALL);
  const canReadAdviseeProgress = permissions.has(PERMISSIONS.PROGRESS_REPORT_READ_ADVISEES);
  const { year, month } = getShanghaiDateParts();
  const projectVisibilityWhere = getProjectVisibilityWhere({ id: user.id, role: user.role, tags: effectiveTags });
  const announcementVisibilityViewer = await getAnnouncementVisibilityViewer(user);
  const announcementWhere = buildAnnouncementVisibilityWhere(announcementVisibilityViewer);
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
      take: 3,
      include: { author: { select: { displayName: true, status: true } } },
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
      orderBy: [{ displayName: "asc" }, { studentId: "asc" }],
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
    grade: formatStudyGrade(member.studyDegree, member.studyGrade),
    status: member.progressReports[0]?.status ?? "MISSING",
  }));
  const metrics: Array<{ label: string; value: number; href?: Route }> = [
    {
      label: "活跃成员",
      value: memberCount,
      href: permissions.has(PERMISSIONS.ADMIN_USER_MANAGE) ? "/admin/users" : undefined,
    },
    { label: "可见项目", value: projectCount, href: "/#projects" },
    { label: "有效公告", value: announcementCount, href: "/#announcements" },
    { label: "未读通知", value: unreadNotificationCount, href: "/#notifications" },
  ];

  return (
    <div>
      <section id="home" data-section="home" className="scroll-mt-[9.625rem] md:scroll-mt-0">
        <div className="space-y-10">
          <DashboardHome />

          <dl className="grid grid-cols-2 gap-y-7 md:grid-cols-4 md:gap-y-0">
            {metrics.map((metric) => {
              const content = (
                <div className="flex min-h-28 flex-col justify-between border-l border-border pl-4 sm:min-h-32 sm:pl-5">
                  <dt className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground">{metric.label}</dt>
                  <dd className="mt-4 text-[38px] font-semibold tabular-nums tracking-[-0.055em] sm:text-[44px]">{metric.value}</dd>
                </div>
              );

              return metric.href ? (
                <Link
                  key={metric.label}
                  href={metric.href}
                  data-dashboard-metric
                  aria-label={`${metric.label}：${metric.value}`}
                  className="group rounded-lg transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&>div]:transition-[border-color] [&>div]:duration-[var(--motion-fast)] hover:[&>div]:border-primary"
                >
                  {content}
                </Link>
              ) : (
                <div key={metric.label}>
                  {content}
                </div>
              );
            })}
          </dl>

          <section className="grid min-w-0 items-start gap-10 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.7fr)] xl:gap-12">
            <section className="min-w-0 space-y-5">
              <SectionHeader title="本月进度" description={`${year} 年 ${month} 月提交状态`} />
              <SummaryTable rows={progressRows} />
            </section>

            <section className="min-w-0 space-y-5">
              <SectionHeader
                title="最新公告"
                description="按置顶与紧急程度优先显示。"
                actions={(
                  <Link href="/#announcements" className="text-sm font-medium text-primary transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:text-primary/80">
                    查看全部<span className="ml-1" aria-hidden="true">›</span>
                  </Link>
                )}
              />
              <AnnouncementList
                announcements={announcements.map((announcement) => ({
                  id: announcement.id,
                  title: announcement.title,
                  content: announcement.content,
                  summary: summarizeAnnouncementContent(announcement.content),
                  authorName: formatActorDisplayName(resolveActorDisplay(announcement.author, announcement.authorSnapshot)),
                  createdAt: formatShanghaiDate(announcement.createdAt),
                  updatedAt: announcement.updatedAt.getTime() > announcement.createdAt.getTime()
                    ? formatShanghaiDate(announcement.updatedAt)
                    : null,
                  isPinned: announcement.isPinned,
                  isUrgent: announcement.isUrgent,
                }))}
                linkToDetail
              />
            </section>
          </section>

          <section className="space-y-5">
            <SectionHeader
              title="最近项目"
              description="按最近更新时间排列。"
              actions={(
                <Link href="/#projects" className="text-sm font-medium text-primary transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:text-primary/80">
                  查看全部<span className="ml-1" aria-hidden="true">›</span>
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
                createdAt: project.createdAt.toISOString(),
                updatedAt: project.updatedAt.toISOString(),
                archivedAt: project.archivedAt?.toISOString() ?? null,
                milestones: [],
              }))}
            />
          </section>
        </div>
      </section>

      <section id="projects" data-section="projects" className="scroll-mt-[9.625rem] border-t-[0.5rem] border-foreground md:scroll-mt-0">
        <ProjectsPage searchParams={Promise.resolve({})} />
      </section>
      {navigationAccess.progress ? (
        <section id="progress" data-section="progress" className="scroll-mt-[9.625rem] border-t-[0.5rem] border-foreground md:scroll-mt-0">
          <ProgressPage searchParams={Promise.resolve({})} />
        </section>
      ) : null}
      <section id="posts" data-section="posts" className="scroll-mt-[9.625rem] border-t-[0.5rem] border-foreground md:scroll-mt-0">
        <PostsPage />
      </section>
      <section id="announcements" data-section="announcements" className="scroll-mt-[9.625rem] border-t-[0.5rem] border-foreground md:scroll-mt-0">
        <AnnouncementsPage searchParams={Promise.resolve({})} />
      </section>
      <section id="notifications" data-section="notifications" className="scroll-mt-[9.625rem] border-t-[0.5rem] border-foreground md:scroll-mt-0">
        <NotificationsPage searchParams={Promise.resolve({})} />
      </section>
      <section id="profile" data-section="profile" className="scroll-mt-[9.625rem] border-t-[0.5rem] border-foreground md:scroll-mt-0">
        <ProfilePage />
      </section>
      {permissions.has(PERMISSIONS.ADMIN_DASHBOARD)?(
        <section id="admin"
        data-section="admin"
        className="scroll-mt-[9.625rem] border-t-[0.5rem] border-foreground md:scroll-mt-0">
        <AdminPage />
        </section>
      ):null}
    </div>
  );
}
