import { DataTable } from "@/shared/components/data-table";

import { TagBadge } from "./tag-badge";

export type TagRow = {
  name: string;
  displayName: string;
  scope: string;
  holderCount: number;
};

export function TagList({ tags }: { tags: readonly TagRow[] }) {
  return (
    <DataTable
      rows={tags}
      columns={[
        { key: "name", header: "标识", cell: (row) => <span className="font-mono text-xs">{row.name}</span> },
        { key: "displayName", header: "显示名", cell: (row) => <TagBadge name={row.name} displayName={row.displayName} /> },
        { key: "scope", header: "范围", cell: (row) => row.scope },
        { key: "holders", header: "持有人", cell: (row) => row.holderCount },
      ]}
    />
  );
}
