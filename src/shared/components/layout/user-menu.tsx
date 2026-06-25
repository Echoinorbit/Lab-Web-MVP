"use client";

import { LogOut, RefreshCw, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";

type UserMenuProps = {
  displayName: string;
  role: "ADMIN" | "MEMBER";
  logoutAction: () => void | Promise<void>;
};

const roleLabels: Record<UserMenuProps["role"], string> = {
  ADMIN: "管理员",
  MEMBER: "成员",
};

export function UserMenu({ displayName, role, logoutAction }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="个人菜单"
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-20 w-56 rounded-md border bg-background p-1 shadow-md"
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{displayName}</div>
              <Badge className="mt-0.5 bg-muted">{roleLabels[role]}</Badge>
            </div>
          </div>

          <div className="my-1 h-px bg-border" />

          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <User className="h-4 w-4" />
            个人中心
          </Link>

          <div className="my-1 h-px bg-border" />

          <form action={logoutAction}>
            <MenuItemButton icon={<RefreshCw className="h-4 w-4" />} label="切换账号" />
            <MenuItemButton
              icon={<LogOut className="h-4 w-4" />}
              label="退出登录"
              className="text-destructive hover:text-destructive"
            />
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MenuItemButton({
  icon,
  label,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      role="menuitem"
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}
