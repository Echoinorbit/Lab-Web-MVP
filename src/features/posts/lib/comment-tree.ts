import type { CommentRow } from "../types";

export type CommentTreeSource = {
  id: string;
  content: string;
  createdAt: Date;
  parentId: string | null;
  deletedAt: Date | null;
  author: { id: string; displayName: string };
};

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function pruneDeletedLeaves(rows: readonly CommentRow[]): CommentRow[] {
  return rows.flatMap((row) => {
    const children = pruneDeletedLeaves(row.children ?? []);
    if (row.isDeleted && children.length === 0) {
      return [];
    }
    return [{ ...row, children }];
  });
}

export function buildCommentTree(comments: readonly CommentTreeSource[]): CommentRow[] {
  const roots: CommentRow[] = [];
  const byId = new Map<string, CommentRow>();

  for (const comment of comments) {
    const isDeleted = comment.deletedAt !== null;
    byId.set(comment.id, {
      id: comment.id,
      content: isDeleted ? "" : comment.content,
      authorId: comment.author.id,
      authorName: comment.author.displayName,
      createdAt: formatDate(comment.createdAt),
      isDeleted,
      children: [],
    });
  }

  for (const comment of comments) {
    const row = byId.get(comment.id);
    if (!row) continue;
    if (comment.parentId) {
      const parent = byId.get(comment.parentId);
      if (parent) {
        parent.children?.push(row);
      } else {
        roots.push(row);
      }
    } else {
      roots.push(row);
    }
  }

  return pruneDeletedLeaves(roots);
}

