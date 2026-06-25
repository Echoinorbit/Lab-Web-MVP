import { ZodError } from "zod";

const POST_FIELD_MESSAGES: Record<string, string> = {
  title: "标题至少需要 2 个字符。",
  content: "正文不能为空。",
  category: "请选择有效分类。",
  tags: "标签最多 12 个，每个标签不超过 40 个字符。",
};

export function formatPostValidationError(error: unknown, fallback: string) {
  if (!(error instanceof ZodError)) {
    return error instanceof Error ? error.message : fallback;
  }

  const field = String(error.issues[0]?.path[0] ?? "");
  return POST_FIELD_MESSAGES[field] ?? "输入内容不符合要求，请检查标题、正文和标签。";
}
