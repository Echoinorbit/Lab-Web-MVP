import { PostForm, PostList } from "@/features/posts";
import { buildMyDraftsWhere, buildPublicPostWhere } from "@/features/posts/lib/drafts";
import { formatPostQuotaNotice } from "@/features/posts/lib/rate-limit-copy";
import { getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { getRateLimitStatus } from "@/shared/lib/rate-limits";
import { requireActiveUser } from "@/shared/lib/session";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function PostsPage() {
  const user = await requireActiveUser();
  const permissions = await getUserPermissions(user.id);
  const canCreate = permissions.has(PERMISSIONS.POST_CREATE);
  const [posts, drafts, postTags, quotaStatus] = await Promise.all([
    prisma.post.findMany({
      where: buildPublicPostWhere(),
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { author: { select: { displayName: true } } },
    }),
    canCreate
      ? prisma.post.findMany({
          where: buildMyDraftsWhere(user.id),
          orderBy: { updatedAt: "desc" },
          take: 20,
          include: { author: { select: { displayName: true } } },
        })
      : Promise.resolve([]),
    canCreate
      ? prisma.userPostTag.findMany({
          where: { userId: user.id },
          orderBy: { label: "asc" },
          select: { id: true, label: true },
        })
      : Promise.resolve([]),
    canCreate ? getRateLimitStatus(user.id, PERMISSIONS.POST_CREATE) : Promise.resolve(null),
  ]);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <div className="space-y-6">
        <PostList
          posts={posts.map((post) => ({
            id: post.id,
            title: post.title,
            authorName: post.author.displayName,
            category: post.category,
            createdAt: formatDate(post.createdAt),
            tags: post.tags,
          }))}
        />
        {drafts.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">我的草稿</h2>
            <PostList
              posts={drafts.map((post) => ({
                id: post.id,
                title: post.title || "未命名草稿",
                authorName: post.author.displayName,
                category: post.category,
                createdAt: formatDate(post.updatedAt),
                tags: post.tags,
              }))}
            />
          </section>
        ) : null}
      </div>
      {canCreate ? <PostForm postTags={postTags} quotaNotice={formatPostQuotaNotice(quotaStatus)} /> : null}
    </div>
  );
}
