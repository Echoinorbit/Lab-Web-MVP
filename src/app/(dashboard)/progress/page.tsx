import Link from "next/link";

import { BackfillWindowForm, ExportButton, ReportForm, ReportList, SummaryTable } from "@/features/progress";
import { withoutEffectiveAdvisorTagWhere } from "@/features/progress/lib/advisor-filter";
import { formatShanghaiDate } from "@/shared/lib/date";
import { getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

const DEFAULT_YEAR = 2026;
const DEFAULT_MONTH = 6;

function resolvePeriod(searchParams: { year?: string; month?: string }) {
  const parsedYear = Number(searchParams.year);
  const parsedMonth = Number(searchParams.month);
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : DEFAULT_YEAR;
  const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : DEFAULT_MONTH;
  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return { year, month, prev, next };
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year, month, prev, next } = resolvePeriod(await searchParams);
  const user = await requireActiveUser();
  const permissions = await getUserPermissions(user.id);
  const canWrite = permissions.has(PERMISSIONS.PROGRESS_REPORT_WRITE);
  const canReadAll = permissions.has(PERMISSIONS.PROGRESS_REPORT_READ_ALL);
  const canExport = permissions.has(PERMISSIONS.PROGRESS_EXPORT);
  const canBackfill = permissions.has(PERMISSIONS.PROGRESS_BACKFILL);
  const progressAudienceWhere = { role: "MEMBER" as const, status: "ACTIVE" as const, ...withoutEffectiveAdvisorTagWhere() };

  const [currentReport, reports, members] = await Promise.all([
    prisma.progressReport.findFirst({
      where: { userId: user.id, year, month, deletedAt: null },
    }),
    prisma.progressReport.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12,
    }),
    canReadAll || canBackfill
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

  const summaryRows = canReadAll
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
            {year} 年 {month} 月
          </span>
          <Link href={`/progress?year=${next.year}&month=${next.month}`} className="rounded-md border px-2 py-1 hover:bg-muted">
            下一月 →
          </Link>
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
        {canReadAll ? <SummaryTable rows={summaryRows} /> : null}
      </div>
    </div>
  );
}
