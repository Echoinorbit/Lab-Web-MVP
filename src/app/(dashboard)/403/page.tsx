import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[65vh] items-center justify-center py-12">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">403</p>
              <CardTitle>你没有权限访问该模块</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">
            当前账号缺少此页面所需的治理权限。系统已记录本次访问结果，你可以返回首页继续处理可访问的事项。
          </p>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回首页
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
