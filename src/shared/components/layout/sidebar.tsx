"use client";

import {
  Bell,
  ClipboardList,
  FlaskConical,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  Megaphone,
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

type NavigationItem = {
  key: NavigationItemKey;
  href: Route;
  label: string;
  icon: typeof LayoutDashboard;
};

const navigationGroups: Array<{ label: string; items: NavigationItem[] }> = [
  {
    label: "工作空间",
    items: [
      { key: "home", href: "/", label: "总览", icon: LayoutDashboard },
      { key: "announcements", href: "/announcements", label: "公告", icon: Megaphone },
      { key: "posts", href: "/posts", label: "帖子", icon: MessageSquare },
      { key: "projects", href: "/projects", label: "项目", icon: FolderKanban },
      { key: "progress", href: "/progress", label: "进度", icon: ClipboardList },
    ],
  },
  {
    label: "个人",
    items: [{ key: "notifications", href: "/notifications", label: "通知", icon: Bell }],
  },
  {
    label: "系统治理",
    items: [
      { key: "admin-users", href: "/admin/users", label: "用户", icon: Users },
      { key: "admin-tags", href: "/admin/tags", label: "Tag", icon: Tags },
      { key: "admin-audit", href: "/admin/audit", label: "操作日志", icon: ShieldCheck },
      { key: "admin-settings", href: "/admin/settings", label: "设置", icon: Settings },
    ],
  },
];

export function Sidebar({ className, access }: { className?: string; access?: NavigationAccessMap }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "hidden w-[272px] shrink-0 border-r border-border/75 bg-card md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto",
        className,
      )}
    >
      <div className="flex h-[68px] items-center border-b border-border/75 px-5">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          aria-label="实验室协作首页"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
            <FlaskConical className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-semibold tracking-[-0.025em]">实验室协作</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">研究协作工作台</span>
          </span>
        </Link>
      </div>

      <nav className="space-y-7 px-3.5 py-5" aria-label="主导航">
        {navigationGroups.map((group) => {
          const visibleItems = group.items.filter((item) => access?.[item.key] ?? true);
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              <h2 className="mb-2 px-3 text-xs font-semibold text-muted-foreground">{group.label}</h2>
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-[color,background-color] duration-[var(--motion-fast)] ease-[var(--ease-fluid)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground active:bg-muted",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon
                          className="h-[18px] w-[18px] shrink-0"
                          strokeWidth={active ? 2.2 : 1.8}
                          aria-hidden="true"
                        />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
