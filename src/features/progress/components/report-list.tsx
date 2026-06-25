import { Badge } from "@/shared/components/ui/badge";
import { DataTable } from "@/shared/components/data-table";

export type ReportRow = {
  yearMonth: string;
  status: "DRAFT" | "SUBMITTED";
  updatedAt: string;
};

export function ReportList({ reports }: { reports: readonly ReportRow[] }) {
  return (
    <DataTable
      rows={reports}
      columns={[
        { key: "period", header: "月份", cell: (row) => row.yearMonth },
        {
          key: "status",
          header: "状态",
          cell: (row) => <Badge className={row.status === "SUBMITTED" ? "bg-primary text-primary-foreground" : "bg-muted"}>{row.status}</Badge>,
        },
        { key: "updatedAt", header: "更新时间", cell: (row) => row.updatedAt },
      ]}
    />
  );
}
