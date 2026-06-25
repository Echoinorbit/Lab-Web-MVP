import type { RateLimitResult } from "@/shared/lib/rate-limits";

export class PostRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostRateLimitError";
  }
}

export function formatPostRateLimitExceeded(result: RateLimitResult) {
  if (result.kind === "limited") {
    return `今天的发帖次数已达上限（${result.max} 篇/天），请明天再试。`;
  }
  return "当前账号没有发帖额度。";
}

export function formatPostQuotaNotice(result: RateLimitResult | null) {
  if (!result) return null;
  if (result.kind === "unlimited") return "今日剩余可发：不限量";
  if (result.kind === "denied") return "今日剩余可发：0 篇";
  return `今日剩余可发：${result.remaining}/${result.max} 篇`;
}
