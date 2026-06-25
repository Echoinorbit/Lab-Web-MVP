import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="max-w-none space-y-3 text-sm leading-6 [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-xl [&_h2]:text-lg [&_li]:ml-4 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:list-disc"
    >
      {content}
    </ReactMarkdown>
  );
}
