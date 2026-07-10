import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { BackfillWindowForm, ExportButton, ReportForm, ReportList, SummaryTable } from "@/features/progress";
import { getProgressAudienceWhere } from "@/features/progress/lib/advisor-filter";
import { resolveProgressWriteWindow } from "@/features/progress/lib/backfill";
import { resolveProgressPeriod } from "@/features/progress/lib/period";
import { buttonStyles } from "@/shared/components/ui/button";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { formatShanghaiDate, canWriteProgressReport } from "@/shared/lib/date";
import { getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const now = new Date();
  const { year, month, prev, next, current, isCurrent } = resolveProgressPeriod(await searchParams, now);
  const user = await requireActiveUser();
  const permissions = await getUserPermissions(user.id);
  const canWrite = permissions.has(PERMISSIONS.PROGRESS_REPORT_WRITE);
  const canReadAll = permissions.has(PERMISSIONS.PROGRESS_REPORT_READ_ALL);
  const canReadAdvisees = permissions.has(PERMISSIONS.PROGRESS_REPORT_READ_ADVISEES);
  const canExport = permissions.has(PERMISSIONS.PROGRESS_EXPORT);
  const canBackfill = permissions.has(PERMISSIONS.PROGRESS_BACKFILL);
  const progressAudienceWhere = getProgressAudienceWhere({
    userId: user.id,
    canReadAll: canReadAll || canBackfill,
    canReadAdvisees,
  });
  const regularWindowOpen = canWriteProgressReport(year, month, now);
  const writeWindow = canWrite
    ? await resolveProgressWriteWindow(user.id, year, month)
    : { allowed: false, backfillWindowId: null };
  const writeMode = regularWindowOpen
    ? "regular" as const
    : writeWindow.allowed
      ? "backfill" as const
      : isCurrent ? "closed-current" as const : "closed-history" as const;

  const [currentReport, reports, members] = await Promise.all([
    prisma.progressReport.findFirst({
      where: { userId: user.id, year, month, deletedAt: null },
    }),
    prisma.progressReport.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12,
    }),
    canReadAll || canReadAdvisees || canBackfill
      ? prisma.user.findMany({
          where: progressAudienceWhere,
          orderBy: [{ grade: "asc" }, { studentId: "asc" }, { displayName: "asc" }],
          include: {
            advisor: { select: { displayName: true } },
            progressReports: {
              where: { year, month, deletedAt: null },
              select: { status: true },
              take: 1,
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const summaryRows = canReadAll || canReadAdvisees
    ? members.map((member) => ({
        studentName: member.displayName,
        studentId: member.studentId ?? "-",
        advisorName: member.advisor?.displayName ?? "-",
        grade: member.grade ?? "-",
        status: member.progressReports[0]?.status ?? ("MISSING" as const),
      }))
    : [];

  return (
    <div className="space-y-10">
      <PageHeader
        title="进度报告"
        description={`${year} 年 ${month} 月${isCurrent ? " · 本月" : " · 历史月份"}。填写窗口、补填授权与提交状态均由服务端判定。`}
        actions={canExport ? <ExportButton year={year} month={month} /> : null}
      />

      <nav aria-label="进度月份" className="flex flex-col gap-3 rounded-2xl border border-border/90 bg-card p-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Link href={`/progress?year=${prev.year}&month=${prev.month}`} className={buttonStyles({ variant: "secondary", size: "small" })}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            上一月
          </Link>
          <Link href={`/progress?year=${next.year}&month=${next.month}`} className={buttonStyles({ variant: "secondary", size: "small" })}>
            下一月
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <strong className="order-first text-center text-sm tabular-nums sm:order-none sm:ml-auto sm:text-left">
          {year} 年 {month} 月
        </strong>
        {!isCurrent ? (
          <Link href={`/progress?year=${current.year}&month=${current.month}`} className={buttonStyles({ variant: "ghost", size: "small", className: "sm:ml-1" })}>
            回到本月
          </Link>
        ) : null}
      </nav>

      {canReadAll || canReadAdvisees ? (
        <section className="space-y-5">
          <SectionHeader title="提交汇总" description={`${summaryRows.length} 位成员在 ${year} 年 ${month} 月的报告状态。`} />
          <SummaryTable rows={summaryRows} />
        </section>
      ) : null}

      <div className={canWrite ? "grid items-start gap-10 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] xl:gap-12" : "max-w-3xl"}>
        {canWrite ? (
          <section className="min-w-0 space-y-5">
            <SectionHeader title="我的报告" description="可保存草稿；提交后不能重复提交，保存修改次数受限。" />
            <ReportForm
              year={year}
              month={month}
              writeMode={writeMode}
              initialValue={
                currentReport
                  ? {
                      studySummary: currentReport.studySummary,
                      projectSummary: currentReport.projectSummary,
                      thesisSummary: currentReport.thesisSummary,
                      otherWork: currentReport.otherWork,
                      externalDays: currentReport.externalDays,
                      status: currentReport.status,
                      editCount: currentReport.editCount,
                    }
                  : null
              }
            />
          </section>
        ) : null}

        <aside className="min-w-0 space-y-8">
          {canBackfill ? (
            <BackfillWindowForm
              year={year}
              month={month}
              users={members.map((member) => ({
                id: member.id,
                displayName: member.displayName,
                username: member.username,
              }))}
            />
          ) : null}
          <section className="space-y-5">
            <SectionHeader title="最近报告" description="最近 12 个月的保存与提交记录。" />
            <ReportList
              reports={reports.map((report) => ({
                yearMonth: `${report.year}-${String(report.month).padStart(2, "0")}`,
                status: report.status,
                updatedAt: formatShanghaiDate(report.updatedAt),
              }))}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}
