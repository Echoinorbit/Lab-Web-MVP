"use client";

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
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();

  return (
    <aside className={cn("hidden w-64 shrink-0 border-r border-border/80 bg-background md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto", className)}>
      <div className="flex h-16 items-center border-b border-border/80 px-5">
        <div>
          <div className="text-[17px] font-semibold tracking-[-0.025em]">实验室协作</div>
          <div className="mt-0.5 text-xs text-muted-foreground">研究协作工作台</div>
        </div>
      </div>
      <nav className="space-y-1 p-3.5" aria-label="主导航">
        {navItems.map((item) => {
          const enabled = access?.[item.key] ?? true;
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
          const itemClassName = cn(
            "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-200",
            enabled
              ? active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-primary/10 active:text-primary"
              : "cursor-not-allowed text-muted-foreground opacity-45",
          );
          const content = (
            <>
              <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={active ? 2.25 : 1.8} aria-hidden="true" />
              {item.label}
            </>
          );

          return enabled ? (
            <Link key={item.href} href={item.href} className={itemClassName} aria-current={active ? "page" : undefined}>
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
