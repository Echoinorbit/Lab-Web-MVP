import { MarkdownRenderer } from "@/shared/components/markdown-renderer";

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
    <article>
      <header className="border-b border-border/80 pb-8">
        <p className="text-sm text-muted-foreground">{authorName}</p>
        <h1 className="mt-4 text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[44px]">{title}</h1>
      </header>
      <div className="py-8 sm:py-10">
        <MarkdownRenderer content={content} />
      </div>
    </article>
  );
}
