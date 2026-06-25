import type { ReactNode } from "react";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
};

export function DataTable<T>({ columns, rows }: { columns: readonly DataTableColumn<T>[]; rows: readonly T[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="border-b px-3 py-2 font-medium">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b last:border-b-0">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-2 align-top">
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
