import type { CommitGraphRow } from "./commit-graph";

export type CommitGraphSelection = {
  selectedId: string | null;
  selectedAuthorId: string | null;
};

export function isCommitRowHighlighted(row: Pick<CommitGraphRow, "id" | "authorId">, selection: CommitGraphSelection) {
  return selection.selectedAuthorId
    ? row.authorId === selection.selectedAuthorId
    : row.id === selection.selectedId;
}

export function isCommitRowDimmed(row: Pick<CommitGraphRow, "id" | "authorId">, selection: CommitGraphSelection) {
  return Boolean(selection.selectedAuthorId) && row.authorId !== selection.selectedAuthorId;
}
