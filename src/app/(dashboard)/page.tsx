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
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">
        {(
          [
            ["成员", memberCount, "/admin/users"],
            ["项目", projectCount, "/projects"],
            ["公告", announcementCount, "/announcements"],
            ["未读通知", unreadNotificationCount, "/notifications"],
          ] satisfies Array<[string, number, Route]>
        ).map(([label, value, href]) => (
          <Link key={label} href={href}>
            <Card className="transition hover:border-primary">
              <CardHeader className="py-3">
                <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-2xl font-semibold">{value}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">公告中心</h2>
              <Link href="/announcements" className="text-sm text-muted-foreground hover:text-foreground">
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
        </div>
        <SummaryTable rows={progressRows} />
      </section>
    </div>
  );
}
