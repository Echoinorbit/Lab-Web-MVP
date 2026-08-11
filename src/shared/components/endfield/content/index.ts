/**
 * Content extracted from the production bundle at
 * `web.hycdn.cn/endfield/official-v4` (zh-cn locale) — see
 * docs/research/TECH_STACK_ANALYSIS.md for how it was recovered.
 */
import type { OperatorData } from "@/types/site";
import operatorData from "./operators.json";
import strings from "./strings.zh-cn.json";

export const operators = operatorData as OperatorData;

const dictionary: Record<string, string> = strings;

/**
 * Looks up a localised string by its original i18n key, e.g. `t("nav.home")`.
 * Returns the key itself when missing so gaps are obvious in the UI.
 */
export function t(key: string): string {
  return dictionary[key] ?? key;
}

/** Every key that starts with `prefix`, in sorted key order. */
export function tList(prefix: string): string[] {
  return Object.keys(dictionary)
    .filter((k) => k.startsWith(prefix))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((k) => dictionary[k]);
}

/**
 * Collects indexed item groups such as `gameplay.items.0.title` /
 * `gameplay.items.0.description` into an ordered array.
 */
export function tItems(prefix: string): { title: string; description: string }[] {
  const items: { title: string; description: string }[] = [];
  for (let i = 0; ; i++) {
    const title = dictionary[`${prefix}.${i}.title`];
    const description = dictionary[`${prefix}.${i}.description`];
    if (title === undefined && description === undefined) break;
    items.push({ title: title ?? "", description: description ?? "" });
  }
  return items;
}
