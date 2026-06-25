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
  return (
    <DataTable
      rows={rows}
      columns={[
        { key: "grade", header: "年级", cell: (row) => row.grade },
        { key: "name", header: "姓名", cell: (row) => row.studentName },
        { key: "studentId", header: "学号", cell: (row) => row.studentId },
        { key: "advisor", header: "导师", cell: (row) => row.advisorName },
        { key: "status", header: "状态", cell: (row) => <Badge>{row.status}</Badge> },
      ]}
    />
  );
}
