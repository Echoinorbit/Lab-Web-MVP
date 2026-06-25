import { Bell, Search } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";

import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

type HeaderProps = {
  displayName: string;
  role: "ADMIN" | "MEMBER";
  unreadCount: number;
  logoutAction: () => void | Promise<void>;
};

export function Header({ displayName, role, unreadCount, logoutAction }: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
      <div className="min-w-0 flex-1">
        <div className="relative max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="搜索公告、项目、成员" />
        </div>
      </div>
      <Link
        href="/notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-muted"
        aria-label={unreadCount > 0 ? `通知，${unreadCount} 条未读` : "通知"}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <Badge className="absolute -right-1 -top-1 min-w-4 justify-center bg-destructive px-1 text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </Link>
      <ThemeToggle />
      <UserMenu displayName={displayName} role={role} logoutAction={logoutAction} />
    </header>
  );
}
