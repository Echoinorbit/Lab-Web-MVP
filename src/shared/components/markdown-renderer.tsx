import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="max-w-[72ch] space-y-4 text-[16px] leading-7 text-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a]:hover:underline [&_blockquote]:rounded-xl [&_blockquote]:border [&_blockquote]:border-border/70 [&_blockquote]:bg-muted/60 [&_blockquote]:px-5 [&_blockquote]:py-4 [&_blockquote]:text-muted-foreground [&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:pt-2 [&_h1]:text-2xl [&_h2]:pt-2 [&_h2]:text-xl [&_h3]:pt-1 [&_h3]:text-lg [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border/75 [&_pre]:bg-muted [&_pre]:p-4 [&_ul]:list-disc"
    >
      {content}
    </ReactMarkdown>
  );
}
