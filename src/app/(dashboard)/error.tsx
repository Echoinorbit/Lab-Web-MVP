"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle className="h-5 w-5" aria-hidden="true" />}
      title="页面暂时无法加载"
      description="请求未完成。请重试；若问题持续，请联系管理员并提供当前页面地址。"
      action={<Button onClick={reset}>重新加载</Button>}
    />
  );
}
