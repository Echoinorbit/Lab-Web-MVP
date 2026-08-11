"use client";

import { HudState } from "@/shared/components/endfield/hud/hud-state";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <HudState code="ERR" label="REQUEST INTERRUPTED" title="页面暂时无法加载" message="请求未完成。请重试；若问题持续，请联系管理员并提供当前页面地址。" actionLabel="重新加载" onAction={reset} />;
}
