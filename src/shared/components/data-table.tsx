import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
};

type DataTableProps<T> = {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  label?: string;
  emptyMessage?: string;
};

export function DataTable<T>({
  columns,
  rows,
  label = "数据列表",
  emptyMessage = "暂无数据",
}: DataTableProps<T>) {
  return (
    <div
      className="min-w-0 max-w-full overflow-x-auto rounded-xl border border-border/80 bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      tabIndex={0}
      role="region"
      aria-label={`${label}，可横向滚动`}
    >
      <table className="w-full min-w-[720px] border-collapse text-[15px] [font-variant-numeric:tabular-nums]">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-surface/75 text-left text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className="border-b border-border/80 px-4 py-3 font-semibold">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b border-border/70 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-muted/45 last:border-b-0"
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3.5 align-top">
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
