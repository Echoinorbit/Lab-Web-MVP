import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { CommentSection, PostDetail, PostModeration } from "@/features/posts";
import { buildCommentTree } from "@/features/posts/lib/comment-tree";
import { buildVisiblePostWhere } from "@/features/posts/lib/drafts";
import { buttonStyles } from "@/shared/components/ui/button";
import { formatActorDisplayName, resolveActorDisplay } from "@/shared/lib/actor-snapshot";
import { formatShanghaiDate } from "@/shared/lib/date";
import { getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireActiveUser();
  const permissions = await getUserPermissions(user.id);
  const post = await prisma.post.findFirst({
    where: buildVisiblePostWhere(user.id, id),
    include: {
      author: { select: { id: true, displayName: true, avatar: true, status: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, displayName: true, status: true } } },
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
    <div className="mx-auto max-w-4xl space-y-8">
      <Link href="/posts" className={buttonStyles({ variant: "ghost", size: "small", className: "-ml-3 w-fit" })}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        返回帖子
      </Link>
      <PostDetail
        title={post.title}
        authorName={`${formatActorDisplayName(resolveActorDisplay(post.author, post.authorSnapshot))} · ${formatShanghaiDate(post.createdAt)}`}
        authorAvatar={post.author?.avatar ?? null}
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
