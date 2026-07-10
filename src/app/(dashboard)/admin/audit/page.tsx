import { AuditLogTable } from "@/features/admin";
import { DataTable } from "@/shared/components/data-table";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { requirePermission } from "@/shared/lib/authorization";
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
  const archiveRows = archives.map((archive) => ({
    id: archive.id,
    fileName: archive.fileName,
    sequence: `seq${archive.seqInYear}`,
    rowCount: archive.rowCount,
    exportedAt: formatShanghaiDateTime(archive.exportedAt),
    expiresAt: formatShanghaiDateTime(archive.expiresAt),
  }));

  return (
    <div className="space-y-10">
      <PageHeader title="操作日志" description={`只追加记录敏感操作与越权尝试。共 ${totalLogs} 条，每页显示 ${AUDIT_LOG_PAGE_SIZE} 条。`} />

      <section className="space-y-5">
        <SectionHeader title="最新记录" description="按发生时间倒序排列，实体 ID 保留用于问题追踪。" />
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
      </section>

      <section className="space-y-5 border-t border-border/80 pt-8">
        <SectionHeader title="历史导出" description="归档保留到对应自然年年底，到期后由导出任务清理。" />
        <DataTable
          label="审计日志历史导出"
          emptyMessage="暂无历史导出"
          rows={archiveRows}
          columns={[
            { key: "fileName", header: "文件名", cell: (row) => row.fileName },
            { key: "sequence", header: "序号", cell: (row) => row.sequence },
            { key: "rowCount", header: "行数", cell: (row) => row.rowCount },
            { key: "exportedAt", header: "导出时间", cell: (row) => row.exportedAt },
            { key: "expiresAt", header: "到期时间", cell: (row) => row.expiresAt },
            {
              key: "download",
              header: "下载",
              cell: (row) => (
                <a className="font-medium text-primary underline-offset-4 hover:underline" href={`/api/admin/audit-export/${row.id}`}>
                  下载
                </a>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}

function formatActor(user: { username: string; displayName: string } | undefined) {
  return user ? `${user.displayName} (${user.username})` : "-";
}
