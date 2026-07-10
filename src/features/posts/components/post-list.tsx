import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

export type PostSummary = {
  id: string;
  title: string;
  authorName: string;
  category: string;
  createdAt: string;
  tags: string[];
  href?: string;
};

export function PostList({ posts }: { posts: readonly PostSummary[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {posts.map((post) => (
        <Link key={post.id} href={(post.href ?? `/posts/${post.id}`) as Route}>
          <Card className="h-full transition-[border-color,background-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-muted/20">
            <CardHeader>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{post.authorName}</span>
                <span className="tabular-nums">{post.createdAt}</span>
              </div>
              <CardTitle className="text-sm">{post.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge>{post.category}</Badge>
              {post.tags.map((tag) => (
                <Badge key={tag} className="bg-muted">
                  {tag}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
