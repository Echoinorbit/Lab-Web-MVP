import { MessagesSquare } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { Avatar } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { EmptyState } from "@/shared/components/ui/empty-state";

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
      <EmptyState
        icon={<MessagesSquare className="h-5 w-5" aria-hidden="true" />}
        title={emptyTitle}
        description="新的讨论与经验分享发布后，会出现在这里。"
      />
    );
  }

  return (
    <div className="divide-y divide-border/65 overflow-hidden rounded-xl border border-border/80 bg-card">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={(post.href ?? `/posts/${post.id}`) as Route}
          className="group block px-5 py-5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-primary/[0.035] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"
        >
          <div className="flex items-center gap-3">
            <Avatar src={post.authorAvatar} name={post.authorName} size={36} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{post.authorName}</span>
              <span aria-hidden="true">·</span>
              <time className="tabular-nums">{post.createdAt}</time>
            </div>
            <Badge className="ml-auto">{categoryLabels[post.category] ?? post.category}</Badge>
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-6 tracking-[-0.022em] transition-colors duration-[var(--motion-fast)] group-hover:text-primary">{post.title}</h3>
          {post.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="text-xs text-muted-foreground">#{tag}</span>
              ))}
            </div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
