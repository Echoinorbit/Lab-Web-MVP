import Link from "next/link";
import type { Route } from "next";

import { AnnouncementList } from "@/features/announcements";
import { ANNOUNCEMENT_ORDER_BY } from "@/features/announcements/lib/sorting";
import { buildAnnouncementVisibilityWhere, getAnnouncementVisibilityViewer } from "@/features/announcements/lib/visibility";
import { ProjectList } from "@/features/projects";
import { canViewProject, getProjectVisibilityWhere } from "@/features/projects/lib/visibility";
import { SummaryTable, type ProgressSummaryRow } from "@/features/progress";
import { getProgressAudienceWhere } from "@/features/progress/lib/advisor-filter";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
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

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-[34px]">协作总览</h1>
        <p className="max-w-2xl text-[15px] leading-6 text-muted-foreground sm:text-base">
          集中查看实验室成员、项目、公告与本月进度。
        </p>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-border bg-border md:grid-cols-4">
        {(
          [
            ["成员", memberCount, "/admin/users"],
            ["项目", projectCount, "/projects"],
            ["公告", announcementCount, "/announcements"],
            ["未读通知", unreadNotificationCount, "/notifications"],
          ] satisfies Array<[string, number, Route]>
        ).map(([label, value, href]) => (
          <Link key={label} href={href} aria-label={`${label}：${value}`} className="group focus-visible:outline-none">
            <Card className="h-full min-h-24 rounded-none border-0 bg-card transition-[background-color,box-shadow] duration-[var(--motion-base)] ease-[var(--ease-fluid)] group-hover:bg-muted/45 group-focus-visible:z-10 group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-ring sm:min-h-28">
              <CardHeader className="border-0 px-5 pb-2 pt-5">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-0 text-[28px] font-semibold tabular-nums tracking-[-0.035em] transition-colors duration-[var(--motion-base)] ease-[var(--ease-fluid)] group-hover:text-primary">{value}</CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-10 xl:grid-cols-[minmax(0,1.12fr)_minmax(420px,0.88fr)] xl:gap-12">
        <div className="min-w-0 space-y-10">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-[-0.025em]">最新公告</h2>
              <Link href="/announcements" className="text-sm font-medium text-primary transition-colors duration-[var(--motion-fast)] ease-[var(--ease-fluid)] after:ml-1 after:content-['›'] hover:text-primary/80">
                查看全部
              </Link>
            </div>
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

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-[-0.025em]">最近项目</h2>
              <Link href="/projects" className="text-sm font-medium text-primary transition-colors duration-[var(--motion-fast)] ease-[var(--ease-fluid)] after:ml-1 after:content-['›'] hover:text-primary/80">
                查看全部
              </Link>
            </div>
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

        <section className="min-w-0 space-y-4 xl:sticky xl:top-24">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.025em]">本月进度</h2>
            <p className="mt-1 text-sm text-muted-foreground">{year} 年 {month} 月提交状态</p>
          </div>
          <SummaryTable rows={progressRows} />
        </section>
      </section>
    </div>
  );
}
