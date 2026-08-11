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
      className="min-w-0 max-w-full overflow-x-auto border-y border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      tabIndex={0}
      role="region"
      aria-label={`${label}，可横向滚动`}
    >
      <table className="w-full min-w-[45rem] border-collapse text-[1rem] [font-variant-numeric:tabular-nums]">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-foreground text-left font-mono text-[.875rem] uppercase tracking-[.05em] text-background">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className="border-b border-foreground/80 px-4 py-3 font-medium">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center font-mono text-[.875rem] uppercase tracking-[.05em] text-muted-foreground">
                // {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="group border-b border-border/70 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hoverable:bg-surface-raised last:border-b-0"
              >
                {columns.map((column) => (
                  <td key={column.key} className="relative px-4 py-3 align-top first:before:absolute first:before:inset-y-0 first:before:left-0 first:before:w-[2px] first:before:bg-brand-yellow first:before:opacity-0 first:before:transition-opacity first:group-hover:before:opacity-100">
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
