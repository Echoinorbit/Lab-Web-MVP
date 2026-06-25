import { MarkdownRenderer } from "@/shared/components/markdown-renderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

export function PostDetail({
  title,
  content,
  authorName,
}: {
  title: string;
  content: string;
  authorName: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="text-xs text-muted-foreground">{authorName}</div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <MarkdownRenderer content={content} />
      </CardContent>
    </Card>
  );
}
