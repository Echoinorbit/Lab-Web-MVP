import { notFound } from "next/navigation";
import type { Route } from "next";

import { CommentSection, PostDetail, PostModeration, type CommentRow } from "@/features/posts";
import { buildVisiblePostWhere } from "@/features/posts/lib/drafts";
import { getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

type CommentWithAuthor = {
  id: string;
  content: string;
  createdAt: Date;
  parentId: string | null;
  author: { id: string; displayName: string };
};

function buildCommentTree(comments: readonly CommentWithAuthor[]): CommentRow[] {
  const roots: CommentRow[] = [];
  const byId = new Map<string, CommentRow>();

  for (const comment of comments) {
    byId.set(comment.id, {
      id: comment.id,
      content: comment.content,
      authorId: comment.author.id,
      authorName: comment.author.displayName,
      createdAt: formatDate(comment.createdAt),
      children: [],
    });
  }

  for (const comment of comments) {
    const row = byId.get(comment.id);
    if (!row) continue;
    if (comment.parentId) {
      byId.get(comment.parentId)?.children?.push(row);
    } else {
      roots.push(row);
    }
  }

  return roots;
}

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireActiveUser();
  const permissions = await getUserPermissions(user.id);
  const post = await prisma.post.findFirst({
    where: buildVisiblePostWhere(user.id, id),
    include: {
      author: { select: { id: true, displayName: true } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, displayName: true } } },
      },
    },
  });
  if (!post) notFound();

  const canEditPost = post.authorId === user.id && permissions.has(PERMISSIONS.POST_UPDATE_OWN);
  const canDeletePost =
    permissions.has(PERMISSIONS.POST_DELETE_ANY) ||
    (post.authorId === user.id && permissions.has(PERMISSIONS.POST_DELETE_OWN));
  const canComment = post.status === "PUBLISHED" && permissions.has(PERMISSIONS.COMMENT_CREATE);

  return (
    <div className="space-y-4">
      <PostDetail
        title={post.title}
        authorName={`${post.author.displayName} · ${formatDate(post.createdAt)}`}
        content={post.content}
      />
      {canEditPost || canDeletePost ? (
        <PostModeration
          postId={post.id}
          canDelete={canDeletePost}
          editHref={canEditPost ? (`/posts/${post.id}/edit` as Route) : undefined}
        />
      ) : null}
      <CommentSection
        postId={post.id}
        comments={buildCommentTree(post.comments)}
        viewerId={user.id}
        canComment={canComment}
        canModerate={permissions.has(PERMISSIONS.COMMENT_DELETE_ANY)}
        canDeleteOwn={permissions.has(PERMISSIONS.COMMENT_DELETE_OWN)}
      />
    </div>
  );
}
