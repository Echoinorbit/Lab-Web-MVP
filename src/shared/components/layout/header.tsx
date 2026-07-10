import { Bell } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import type { NavigationAccessMap } from "@/shared/lib/navigation-access";

import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type HeaderProps = {
  displayName: string;
  role: "ADMIN" | "MEMBER";
  unreadCount: number;
  navigationAccess: NavigationAccessMap;
  logoutAction: () => void | Promise<void>;
};

export function Header({ displayName, role, unreadCount, navigationAccess, logoutAction }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-1.5 border-b border-border/80 bg-background/80 px-3 backdrop-blur-xl sm:gap-2 sm:px-6">
      <MobileNav access={navigationAccess} />
      <div className="min-w-0 flex-1 md:hidden">
        <div className="truncate px-1 text-[15px] font-semibold tracking-[-0.018em]">实验室协作</div>
      </div>
      <div className="hidden min-w-0 flex-1 md:block" />
      <Link
        href="/notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[var(--motion-fast)] ease-[var(--ease-fluid)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={unreadCount > 0 ? `通知，${unreadCount} 条未读` : "通知"}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <Badge className="absolute -right-1 -top-1 min-h-4 min-w-4 justify-center bg-destructive px-1 py-0 text-[10px] text-destructive-foreground ring-2 ring-background">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </Link>
      <ThemeToggle />
      <UserMenu displayName={displayName} role={role} logoutAction={logoutAction} />
    </header>
  );
}
