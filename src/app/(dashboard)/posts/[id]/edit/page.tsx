import { notFound, redirect } from "next/navigation";

import { PostEditForm, PostForm } from "@/features/posts";
import { formatPostQuotaNotice } from "@/features/posts/lib/rate-limit-copy";
import { FORBIDDEN_ROUTE } from "@/shared/lib/access-denied";
import { getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { getRateLimitStatus } from "@/shared/lib/rate-limits";
import { requireActiveUser } from "@/shared/lib/session";

export default async function PostEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireActiveUser();
  const [permissions, post, postTags] = await Promise.all([
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
    prisma.userPostTag.findMany({
      where: { userId: user.id },
      orderBy: { label: "asc" },
      select: { id: true, label: true },
    }),
  ]);

  if (!post) notFound();
  if (post.authorId !== user.id || !permissions.has(PERMISSIONS.POST_UPDATE_OWN)) redirect(FORBIDDEN_ROUTE);
  const quotaStatus =
    post.status === "DRAFT" && permissions.has(PERMISSIONS.POST_CREATE)
      ? await getRateLimitStatus(user.id, PERMISSIONS.POST_CREATE)
      : null;

  const optionLabels = new Set(postTags.map((tag) => tag.label));
  const missingTagOptions = [];
  for (const label of post.tags) {
    if (optionLabels.has(label)) continue;
    optionLabels.add(label);
    missingTagOptions.push({ id: `post-${label}`, label });
  }
  const tagOptions = [...postTags, ...missingTagOptions];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">编辑帖子</h1>
        <p className="text-sm text-muted-foreground">只会修改当前帖子，历史标签以文本快照保留。</p>
      </div>
      {post.status === "DRAFT" ? (
        <PostForm
          postTags={tagOptions}
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
          postTags={tagOptions}
        />
      )}
    </div>
  );
}
