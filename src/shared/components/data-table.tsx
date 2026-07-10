import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
};

export function DataTable<T>({ columns, rows }: { columns: readonly DataTableColumn<T>[]; rows: readonly T[] }) {
  return (
    <div className="min-w-0 max-w-full overflow-x-auto rounded-[18px] border border-border bg-card">
      <table className="w-full min-w-[720px] border-collapse text-[15px] [font-variant-numeric:tabular-nums]">
        <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="border-b border-border/80 px-4 py-3 font-semibold">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-border/70 transition-colors duration-150 hover:bg-muted/40 last:border-b-0">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3 align-top">
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
