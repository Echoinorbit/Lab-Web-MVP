import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { buttonStyles } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[68vh] items-center justify-center py-12">
      <EmptyState
        className="w-full max-w-2xl border-y-0"
        icon={<ShieldAlert className="h-5 w-5" aria-hidden="true" />}
        title="你没有权限访问此区域"
        description="当前账号缺少此页面所需的治理权限。权限由角色与有效 Tag 实时计算，你仍可返回工作台处理可访问事项。"
        action={(
          <Link href="/dashboard" className={buttonStyles()}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回总览
          </Link>
        )}
      />
    </div>
  );
}
