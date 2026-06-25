import { z } from "zod";

export const postTagLabelSchema = z.string().trim().min(1).max(40);

export function buildUserPostTagListArgs(userId: string) {
  return {
    where: { userId },
    orderBy: { label: "asc" as const },
    select: { id: true, label: true },
  };
}

export function buildUserPostTagUpsertArgs(userId: string, label: string) {
  const normalized = normalizePostTagLabel(label);
  return {
    where: { userId_label: { userId, label: normalized } },
    create: { userId, label: normalized },
    update: {},
    select: { id: true, label: true },
  };
}

export function buildUserPostTagDeleteWhere(userId: string, id: string) {
  return { id, userId };
}

export function normalizePostTagLabel(label: string) {
  return postTagLabelSchema.parse(label);
}

export function mergePostTagLabels(...groups: readonly string[][]) {
  const labels: string[] = [];
  for (const group of groups) {
    for (const label of group) {
      const normalized = label.trim();
      if (normalized && !labels.includes(normalized)) labels.push(normalized);
    }
  }
  return labels;
}

export function joinPostTagLabels(tags: readonly string[]) {
  return tags.join("，");
}
