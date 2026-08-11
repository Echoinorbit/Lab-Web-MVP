/** Produces compact list text without rendering a second truncated Markdown document. */
export function summarizeAnnouncementContent(content: string, maxLength = 140) {
  const plainText = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}(?:[-*+] |\d+[.)] )/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!plainText) return "暂无内容";
  return plainText.length > maxLength ? `${plainText.slice(0, maxLength - 1)}…` : plainText;
}
