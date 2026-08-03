import { DataTable } from "@/shared/components/data-table";

import type { AuditEntityIdentity } from "../lib/audit-entity-display";

export type AuditLogRow = {
  createdAt: string;
  actor: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityUser?: AuditEntityIdentity;
};

export function AuditLogTable({ rows }: { rows: readonly AuditLogRow[] }) {
  return (
    <DataTable
      label="操作日志记录"
      emptyMessage="暂无操作日志"
      rows={rows}
      columns={[
        { key: "time", header: "时间", cell: (row) => row.createdAt },
        { key: "actor", header: "操作人", cell: (row) => row.actor },
        { key: "action", header: "动作", cell: (row) => row.action },
        {
          key: "entity",
          header: "实体",
          cell: (row) => (
            <div className="min-w-52">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {row.entityType}
              </div>
              {row.entityUser ? (
                <div className="mt-1.5">
                  <div className="font-medium text-foreground">{row.entityUser.displayName}</div>
                  {row.entityUser.username ? (
                    <div className="mt-0.5 text-sm text-muted-foreground">@{row.entityUser.username}</div>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-1.5 font-mono text-xs text-muted-foreground">{row.entityId ?? "—"}</div>
            </div>
          ),
        },
      ]}
    />
  );
}
