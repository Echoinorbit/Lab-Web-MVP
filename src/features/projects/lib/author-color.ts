import type { ProjectCanvasSourceNode } from "./node-canvas";

const authorPalette = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#b45309",
  "#be123c",
  "#047857",
  "#4338ca",
  "#c2410c",
  "#0e7490",
  "#a21caf",
  "#4d7c0f",
  "#b91c1c",
] as const;

const hexColorPattern = /^#[0-9a-fA-F]{6}$/;

export function colorForAuthor(authorId: string) {
  let hash = 2166136261;
  for (let index = 0; index < authorId.length; index += 1) {
    hash ^= authorId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return authorPalette[Math.abs(hash) % authorPalette.length];
}

export function resolveAuthorColor({ authorId, colorHex }: { authorId: string; colorHex?: string | null }) {
  const normalized = colorHex?.trim();
  if (normalized && hexColorPattern.test(normalized)) {
    return normalized;
  }
  return colorForAuthor(authorId);
}

export function buildAuthorLegend(nodes: readonly ProjectCanvasSourceNode[]) {
  const byAuthor = new Map<string, { authorId: string; authorName: string; color: string }>();
  for (const node of nodes) {
    if (byAuthor.has(node.authorId)) continue;
    byAuthor.set(node.authorId, {
      authorId: node.authorId,
      authorName: node.authorName,
      color: resolveAuthorColor({ authorId: node.authorId, colorHex: node.colorHex }),
    });
  }
  return [...byAuthor.values()];
}
