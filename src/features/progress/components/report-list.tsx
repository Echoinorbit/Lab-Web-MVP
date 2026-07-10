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
      label="最近进度报告"
      emptyMessage="暂无进度报告"
      rows={reports}
      columns={[
        { key: "period", header: "月份", cell: (row) => row.yearMonth },
        {
          key: "status",
          header: "状态",
          cell: (row) => <Badge className={row.status === "SUBMITTED" ? "border-success/25 bg-success/10 text-success" : "bg-muted"}>{row.status === "SUBMITTED" ? "已提交" : "草稿"}</Badge>,
        },
        { key: "updatedAt", header: "更新时间", cell: (row) => row.updatedAt },
      ]}
    />
  );
}
