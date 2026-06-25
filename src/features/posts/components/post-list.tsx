import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

export type PostSummary = {
  id: string;
  title: string;
  authorName: string;
  category: string;
  createdAt: string;
  tags: string[];
};

export function PostList({ posts }: { posts: readonly PostSummary[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {posts.map((post) => (
        <Link key={post.id} href={`/posts/${post.id}`}>
          <Card className="h-full transition hover:border-primary">
            <CardHeader>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>{post.authorName}</span>
                <span>{post.createdAt}</span>
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
