import { Badge } from "@/shared/components/ui/badge";
import { DataTable } from "@/shared/components/data-table";

export type ProgressSummaryRow = {
  studentName: string;
  studentId: string;
  advisorName: string;
  grade: string;
  status: "DRAFT" | "SUBMITTED" | "MISSING";
};

export function SummaryTable({ rows }: { rows: readonly ProgressSummaryRow[] }) {
  const statusLabels: Record<ProgressSummaryRow["status"], string> = {
    DRAFT: "草稿",
    SUBMITTED: "已提交",
    MISSING: "未填写",
  };

  return (
    <DataTable
      label="进度提交汇总"
      emptyMessage="当前范围内暂无成员"
      rows={rows}
      columns={[
        { key: "grade", header: "年级", cell: (row) => row.grade },
        { key: "name", header: "姓名", cell: (row) => row.studentName },
        { key: "studentId", header: "学号", cell: (row) => row.studentId },
        { key: "advisor", header: "导师", cell: (row) => row.advisorName },
        {
          key: "status",
          header: "状态",
          cell: (row) => (
            <Badge className={row.status === "SUBMITTED" ? "border-success/25 bg-success/10 text-success" : row.status === "MISSING" ? "border-warning/30 bg-warning/10 text-warning" : undefined}>
              {statusLabels[row.status]}
            </Badge>
          ),
        },
      ]}
    />
  );
}
