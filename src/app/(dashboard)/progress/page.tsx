import Link from "next/link";

import { BackfillWindowForm, ExportButton, ReportForm, ReportList, SummaryTable } from "@/features/progress";
import { getProgressAudienceWhere } from "@/features/progress/lib/advisor-filter";
import { resolveProgressWriteWindow } from "@/features/progress/lib/backfill";
import { resolveProgressPeriod } from "@/features/progress/lib/period";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/progress?year=${prev.year}&month=${prev.month}`} className="rounded-md border px-2 py-1 hover:bg-muted">
            ← 上一月
          </Link>
          <span className="font-medium">
            {year} 年 {month} 月{isCurrent ? "（本月）" : ""}
          </span>
          <Link href={`/progress?year=${next.year}&month=${next.month}`} className="rounded-md border px-2 py-1 hover:bg-muted">
            下一月 →
          </Link>
          {!isCurrent ? (
            <Link href={`/progress?year=${current.year}&month=${current.month}`} className="rounded-md border px-2 py-1 hover:bg-muted">
              回到本月
            </Link>
          ) : null}
        </div>
        {canExport ? <ExportButton year={year} month={month} /> : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          {canWrite
            ? (
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
              )
            : null}
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
          <ReportList
            reports={reports.map((report) => ({
              yearMonth: `${report.year}-${String(report.month).padStart(2, "0")}`,
              status: report.status,
              updatedAt: formatShanghaiDate(report.updatedAt),
            }))}
          />
        </div>
        {canReadAll || canReadAdvisees ? <SummaryTable rows={summaryRows} /> : null}
      </div>
    </div>
  );
}
