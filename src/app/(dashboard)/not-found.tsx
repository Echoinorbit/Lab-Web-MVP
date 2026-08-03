import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

import { buttonStyles } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[68vh] items-center justify-center py-12">
      <EmptyState
        className="w-full max-w-2xl border-y-0"
        icon={<SearchX className="h-5 w-5" aria-hidden="true" />}
        title="这个页面不在工作区中"
        description="记录可能已被删除、归档，或当前链接已经失效。返回总览可继续处理可访问事项。"
        action={(
          <Link href="/" className={buttonStyles()}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回总览
          </Link>
        )}
      />
    </div>
  );
}
