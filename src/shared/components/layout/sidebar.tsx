import {
  Bell,
  ChartNoAxesCombined,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Settings,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { Badge } from "@/shared/components/ui/badge";
import type { NavigationAccessMap, NavigationItemKey } from "@/shared/lib/navigation-access";
import { cn } from "@/shared/lib/utils";

const navItems: Array<{ key: NavigationItemKey; href: Route; label: string; icon: typeof LayoutDashboard }> = [
  { key: "home", href: "/", label: "总览", icon: LayoutDashboard },
  { key: "announcements", href: "/announcements", label: "公告", icon: Bell },
  { key: "posts", href: "/posts", label: "帖子", icon: MessageSquare },
  { key: "projects", href: "/projects", label: "项目", icon: FolderKanban },
  { key: "progress", href: "/progress", label: "进度", icon: ClipboardList },
  { key: "notifications", href: "/notifications", label: "通知", icon: ChartNoAxesCombined },
  { key: "admin-users", href: "/admin/users", label: "用户", icon: Users },
  { key: "admin-tags", href: "/admin/tags", label: "Tag", icon: Tags },
  { key: "admin-audit", href: "/admin/audit", label: "操作日志记录", icon: ShieldCheck },
  { key: "admin-settings", href: "/admin/settings", label: "设置", icon: Settings },
];

export function Sidebar({ className, access }: { className?: string; access?: NavigationAccessMap }) {
  return (
    <aside className={cn("hidden w-60 shrink-0 border-r bg-card md:block", className)}>
      <div className="border-b px-4 py-4">
        <div className="text-sm font-semibold">实验室协作</div>
        <div className="mt-2 flex items-center gap-2">
          <Badge className="bg-secondary text-secondary-foreground">v0.1</Badge>
          <span className="text-xs text-muted-foreground">Next + Prisma</span>
        </div>
      </div>
      <nav className="space-y-1 p-2">
        {navItems.map((item) => {
          const enabled = access?.[item.key] ?? true;
          const itemClassName = cn(
            "flex h-9 items-center gap-2 rounded-md px-3 text-sm transition-colors",
            enabled
              ? "text-muted-foreground hover:bg-muted hover:text-foreground"
              : "cursor-not-allowed text-muted-foreground opacity-45",
          );
          const content = (
            <>
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </>
          );

          return enabled ? (
            <Link key={item.href} href={item.href} className={itemClassName}>
              {content}
            </Link>
          ) : (
            <span key={item.href} className={itemClassName} aria-disabled="true">
              {content}
            </span>
          );
        })}
      </nav>
    </aside>
  );
}
