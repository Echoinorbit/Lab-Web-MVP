import { DataTable } from "@/shared/components/data-table";

export type AuditLogRow = {
  createdAt: string;
  actor: string;
  action: string;
  entityType: string;
  entityId?: string;
};

export function AuditLogTable({ rows }: { rows: readonly AuditLogRow[] }) {
  return (
    <DataTable
      rows={rows}
      columns={[
        { key: "time", header: "时间", cell: (row) => row.createdAt },
        { key: "actor", header: "操作人", cell: (row) => row.actor },
        { key: "action", header: "动作", cell: (row) => row.action },
        { key: "entity", header: "实体", cell: (row) => `${row.entityType}:${row.entityId ?? "-"}` },
      ]}
    />
  );
}
