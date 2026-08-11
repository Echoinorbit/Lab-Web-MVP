import Link from "next/link";
import type { Route } from "next";

import { Avatar } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";

export type PostSummary = {
  id: string;
  title: string;
  authorName: string;
  authorAvatar?: string | null;
  category: string;
  createdAt: string;
  tags: string[];
  href?: string;
};

const categoryLabels: Record<string, string> = {
  GENERAL: "综合",
  EXPERIENCE: "经验分享",
  TUTORIAL: "教程",
  DISCUSSION: "讨论",
  RESOURCE: "资源分享",
};

export function PostList({ posts, emptyTitle = "暂无帖子" }: { posts: readonly PostSummary[]; emptyTitle?: string }) {
  if (posts.length === 0) {
    return (
      <div className="border-y border-dashed border-border px-8 py-20 text-center font-mono text-[.875rem] uppercase tracking-[.05em] text-muted-foreground portrait:px-6">
        // {emptyTitle}。新的讨论与经验分享发布后，会出现在这里。
      </div>
    );
  }

  return (
    <div className="border-y border-border bg-card">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={(post.href ?? `/posts/${post.id}`) as Route}
          className="group block border-b border-border px-8 py-7 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] last:border-b-0 hoverable:hover:bg-surface-raised focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring portrait:px-6"
        >
          <div className="flex items-center gap-3">
            <Avatar src={post.authorAvatar} name={post.authorName} size={36} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[.8125rem] uppercase tracking-[.04em] text-muted-foreground">
              <span>// {post.authorName}</span>
              <time className="tabular-nums">{post.createdAt}</time>
            </div>
            <Badge className="ml-auto">{categoryLabels[post.category] ?? post.category}</Badge>
          </div>
          <h3 className="mt-4 font-medium text-[1.75rem] leading-7 transition-colors duration-[var(--motion-fast)] group-hover:text-primary portrait:text-[1.375rem]">{post.title}</h3>
          {post.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="font-mono text-[.8125rem] uppercase tracking-[.04em] text-muted-foreground">#{tag}</span>
              ))}
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
