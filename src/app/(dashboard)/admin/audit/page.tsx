import { AuditLogTable } from "@/features/admin";
import { requirePermission } from "@/shared/lib/authorization";
import { Pagination } from "@/shared/components/ui/pagination";
import { formatShanghaiDateTime } from "@/shared/lib/date";
import { getPaginationState, parsePageParam } from "@/shared/lib/pagination";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";

const AUDIT_LOG_PAGE_SIZE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePermission({ permission: PERMISSIONS.ADMIN_AUDIT_VIEW, entityType: "AuditLog" });
  const requestedPage = parsePageParam((await searchParams).page);
  const [totalLogs, archives] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditExportArchive.findMany({
      orderBy: { exportedAt: "desc" },
      take: 20,
      select: {
        id: true,
        fileName: true,
        rowCount: true,
        seqInYear: true,
        exportedAt: true,
        expiresAt: true,
      },
    }),
  ]);
  const pagination = getPaginationState({
    page: requestedPage,
    totalItems: totalLogs,
    pageSize: AUDIT_LOG_PAGE_SIZE,
  });
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: pagination.skip,
    take: pagination.pageSize,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((row) => row.userId).filter((userId): userId is string => Boolean(userId)) } },
    select: { id: true, username: true, displayName: true },
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">操作日志记录</h1>
        <p className="text-sm text-muted-foreground">每页显示 {AUDIT_LOG_PAGE_SIZE} 条记录。</p>
      </div>
      <AuditLogTable
        rows={rows.map((row) => ({
          createdAt: formatShanghaiDateTime(row.createdAt),
          actor: row.userId ? formatActor(userById.get(row.userId)) : "-",
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId ?? undefined,
        }))}
      />
      <Pagination basePath="/admin/audit" currentPage={pagination.currentPage} totalPages={pagination.totalPages} />
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">历史导出</h2>
          <p className="text-sm text-muted-foreground">保留到对应自然年年底，到期后由导出任务清理。</p>
        </div>
        {archives.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-[var(--shadow-card)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/70 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">文件名</th>
                  <th className="px-3 py-2 font-medium">序号</th>
                  <th className="px-3 py-2 font-medium">行数</th>
                  <th className="px-3 py-2 font-medium">导出时间</th>
                  <th className="px-3 py-2 font-medium">到期时间</th>
                  <th className="px-3 py-2 font-medium">下载</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((archive) => (
                  <tr key={archive.id} className="border-t transition-colors hover:bg-muted/50">
                    <td className="px-3 py-2">{archive.fileName}</td>
                    <td className="px-3 py-2">seq{archive.seqInYear}</td>
                    <td className="px-3 py-2">{archive.rowCount}</td>
                    <td className="px-3 py-2">{formatShanghaiDateTime(archive.exportedAt)}</td>
                    <td className="px-3 py-2">{formatShanghaiDateTime(archive.expiresAt)}</td>
                    <td className="px-3 py-2">
                      <a
                        className="text-primary underline-offset-4 hover:underline"
                        href={`/api/admin/audit-export/${archive.id}`}
                      >
                        下载
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-[var(--shadow-card)]">暂无历史导出</div>
        )}
      </section>
    </div>
  );
}

function formatActor(user: { username: string; displayName: string } | undefined) {
  return user ? `${user.displayName} (${user.username})` : "-";
}
