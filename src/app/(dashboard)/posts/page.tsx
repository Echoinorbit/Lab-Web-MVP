import { PostForm, PostList } from "@/features/posts";
import { buildMyDraftsWhere, buildPublicPostWhere } from "@/features/posts/lib/drafts";
import { formatPostQuotaNotice } from "@/features/posts/lib/rate-limit-copy";
import { formatShanghaiDate } from "@/shared/lib/date";
import { getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { getRateLimitStatus } from "@/shared/lib/rate-limits";
import { requireActiveUser } from "@/shared/lib/session";

export default async function PostsPage() {
  const user = await requireActiveUser();
  const permissions = await getUserPermissions(user.id);
  const canCreate = permissions.has(PERMISSIONS.POST_CREATE);
  const [posts, drafts, quotaStatus] = await Promise.all([
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
    canCreate ? getRateLimitStatus(user.id, PERMISSIONS.POST_CREATE) : Promise.resolve(null),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-6">
        <PostList
          posts={posts.map((post) => ({
            id: post.id,
            title: post.title,
            authorName: post.author.displayName,
            category: post.category,
            createdAt: formatShanghaiDate(post.createdAt),
            tags: post.tags,
          }))}
        />
        {drafts.length > 0 ? (
          <section className="space-y-4">
            <h2 className="text-base font-semibold tracking-tight">我的草稿</h2>
            <PostList
              posts={drafts.map((post) => ({
                id: post.id,
                title: post.title || "未命名草稿",
                authorName: post.author.displayName,
                category: post.category,
                createdAt: formatShanghaiDate(post.updatedAt),
                tags: post.tags,
                href: `/posts/${post.id}/edit`,
              }))}
            />
          </section>
        ) : null}
      </div>
      {canCreate ? <PostForm quotaNotice={formatPostQuotaNotice(quotaStatus)} /> : null}
    </div>
  );
}
