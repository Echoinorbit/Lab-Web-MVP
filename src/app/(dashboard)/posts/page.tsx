import { PostForm, PostList } from "@/features/posts";
import { buildMyDraftsWhere, buildPublicPostWhere } from "@/features/posts/lib/drafts";
import { formatPostQuotaNotice } from "@/features/posts/lib/rate-limit-copy";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { resolveActorDisplay } from "@/shared/lib/actor-snapshot";
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
      include: { author: { select: { displayName: true, avatar: true } } },
    }),
    canCreate
      ? prisma.post.findMany({
          where: buildMyDraftsWhere(user.id),
          orderBy: { updatedAt: "desc" },
          take: 20,
          include: { author: { select: { displayName: true, avatar: true } } },
        })
      : Promise.resolve([]),
    canCreate ? getRateLimitStatus(user.id, PERMISSIONS.POST_CREATE) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-10">
      <PageHeader title="帖子" description="分享研究经验、教程、资源与待讨论的问题。公开帖子对实验室成员可见。" />
      <div className={canCreate ? "grid min-w-0 gap-10 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start xl:gap-12" : "min-w-0"}>
        <div className="min-w-0 space-y-12">
          <section className="space-y-5">
            <SectionHeader title="最新讨论" description={`${posts.length} 篇公开帖子`} />
            <PostList
              posts={posts.map((post) => ({
                id: post.id,
                title: post.title,
                authorName: resolveActorDisplay(post.author, post.authorSnapshot).displayName,
                authorAvatar: post.author?.avatar ?? null,
                category: post.category,
                createdAt: formatShanghaiDate(post.createdAt),
                tags: post.tags,
              }))}
            />
          </section>

          {canCreate ? (
            <section className="space-y-5">
              <SectionHeader title="我的草稿" description="自动保存或手动保存的未发布内容。" />
              <PostList
                emptyTitle="暂无草稿"
                posts={drafts.map((post) => ({
                  id: post.id,
                  title: post.title || "未命名草稿",
                  authorName: resolveActorDisplay(post.author, post.authorSnapshot).displayName,
                  authorAvatar: post.author?.avatar ?? null,
                  category: post.category,
                  createdAt: formatShanghaiDate(post.updatedAt),
                  tags: post.tags,
                  href: `/posts/${post.id}/edit`,
                }))}
              />
            </section>
          ) : null}
        </div>

        {canCreate ? (
          <aside className="rounded-2xl border border-border/90 bg-card p-5 sm:p-6 xl:sticky xl:top-24">
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-[-0.025em]">新建帖子</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">发布前可保存草稿，离开页面时系统也会尝试自动保存。</p>
            </div>
            <PostForm quotaNotice={formatPostQuotaNotice(quotaStatus)} />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
