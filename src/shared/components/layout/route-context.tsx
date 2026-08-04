"use client";

import { usePathname } from "next/navigation";

const routeContexts = [
  { prefix: "/admin", label: "系统治理" },
  { prefix: "/announcements", label: "公告" },
  { prefix: "/notifications", label: "通知" },
  { prefix: "/posts", label: "帖子" },
  { prefix: "/progress", label: "进度" },
  { prefix: "/projects", label: "项目" },
  { prefix: "/profile", label: "个人中心" },
  { prefix: "/403", label: "访问受限" },
] as const;

export function RouteContext() {
  const pathname = usePathname();
  const label = pathname === "/dashboard" ? "总览" : routeContexts.find((item) => pathname.startsWith(item.prefix))?.label ?? "工作台";

  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
      {label}
    </span>
  );
}
