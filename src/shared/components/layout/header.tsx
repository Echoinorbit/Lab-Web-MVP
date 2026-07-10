import { Bell } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import type { NavigationAccessMap } from "@/shared/lib/navigation-access";

import { MobileNav } from "./mobile-nav";
import { RouteContext } from "./route-context";
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
    <header className="sticky top-0 z-30 flex h-[68px] items-center gap-2 border-b border-border/75 bg-background/90 px-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <MobileNav access={navigationAccess} />
      <div className="min-w-0 flex-1 px-1 md:px-0">
        <RouteContext />
      </div>
      <Link
        href="/notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[var(--motion-fast)] ease-[var(--ease-fluid)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={unreadCount > 0 ? `通知，${unreadCount} 条未读` : "通知"}
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
        {unreadCount > 0 ? (
          <Badge className="absolute -right-1 -top-1 min-h-4 min-w-4 justify-center border-2 border-background bg-destructive px-1 py-0 text-[10px] text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </Link>
      <ThemeToggle />
      <UserMenu displayName={displayName} role={role} logoutAction={logoutAction} />
    </header>
  );
}
