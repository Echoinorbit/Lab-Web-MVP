import { notFound, redirect } from "next/navigation";

import { PostEditForm, PostForm } from "@/features/posts";
import { formatPostQuotaNotice } from "@/features/posts/lib/rate-limit-copy";
import { Card, CardContent } from "@/shared/components/ui/card";
import { PageHeader } from "@/shared/components/ui/page-header";
import { FORBIDDEN_ROUTE } from "@/shared/lib/access-denied";
import { getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { getRateLimitStatus } from "@/shared/lib/rate-limits";
import { requireActiveUser } from "@/shared/lib/session";

export default async function PostEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireActiveUser();
  const [permissions, post] = await Promise.all([
    getUserPermissions(user.id),
    prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        content: true,
        category: true,
        tags: true,
        status: true,
        authorId: true,
      },
    }),
  ]);

  if (!post) notFound();
  if (post.authorId !== user.id || !permissions.has(PERMISSIONS.POST_UPDATE_OWN)) redirect(FORBIDDEN_ROUTE);
  const quotaStatus =
    post.status === "DRAFT" && permissions.has(PERMISSIONS.POST_CREATE)
      ? await getRateLimitStatus(user.id, PERMISSIONS.POST_CREATE)
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title={post.status === "DRAFT" ? "继续编辑草稿" : "编辑帖子"} description="只会修改当前帖子；历史标签以文本快照保留。" />
      <Card>
        <CardContent>
          {post.status === "DRAFT" ? (
            <PostForm
              initialDraft={{
                id: post.id,
                title: post.title,
                category: post.category,
                content: post.content,
                tags: post.tags,
              }}
              quotaNotice={formatPostQuotaNotice(quotaStatus)}
            />
          ) : (
            <PostEditForm
              postId={post.id}
              title={post.title}
              category={post.category}
              content={post.content}
              tags={post.tags}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
