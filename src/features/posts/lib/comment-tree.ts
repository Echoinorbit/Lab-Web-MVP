import type { Prisma, UserStatus } from "@prisma/client";

import { formatActorDisplayName, resolveActorDisplay } from "@/shared/lib/actor-snapshot";
import { formatShanghaiDate } from "@/shared/lib/date";

import type { CommentRow } from "../types";

export type CommentTreeSource = {
  id: string;
  content: string;
  createdAt: Date;
  parentId: string | null;
  deletedAt: Date | null;
  author: { id: string; displayName: string; studyDegree?: null; status?: UserStatus } | null;
  authorSnapshot?: Prisma.JsonValue;
};

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
    const actor = resolveActorDisplay(
      comment.author ? { ...comment.author, studyDegree: null } : null,
      comment.authorSnapshot,
    );
    byId.set(comment.id, {
      id: comment.id,
      content: isDeleted ? "" : comment.content,
      authorId: isDeleted ? "" : comment.author?.id ?? "",
      authorName: isDeleted ? "已删除评论" : formatActorDisplayName(actor),
      createdAt: formatShanghaiDate(comment.createdAt),
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
