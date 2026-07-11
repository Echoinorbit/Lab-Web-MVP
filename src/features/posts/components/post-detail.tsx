import { MarkdownRenderer } from "@/shared/components/markdown-renderer";
import { Avatar } from "@/shared/components/ui/avatar";

export function PostDetail({
  title,
  content,
  authorName,
  authorAvatar,
}: {
  title: string;
  content: string;
  authorName: string;
  authorAvatar?: string | null;
}) {
  return (
    <article>
      <header className="border-b border-border/80 pb-8">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Avatar src={authorAvatar} name={authorName} size={40} />
          <p>{authorName}</p>
        </div>
        <h1 className="mt-4 text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[44px]">{title}</h1>
      </header>
      <div className="py-8 sm:py-10">
        <MarkdownRenderer content={content} />
      </div>
    </article>
  );
}
