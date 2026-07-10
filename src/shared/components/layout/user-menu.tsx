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
        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-[background-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-fluid)] hover:bg-primary/90 active:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="个人菜单"
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          className="ui-popover-enter absolute right-0 top-12 z-40 w-60 origin-top-right rounded-2xl border border-border bg-surface-raised p-1.5 shadow-[var(--shadow-popover)]"
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{displayName}</div>
              <Badge className="mt-1 bg-muted">{roleLabels[role]}</Badge>
            </div>
          </div>

          <div className="my-1 h-px bg-border" />

          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex h-10 items-center gap-2 rounded-[10px] px-3 text-sm text-muted-foreground transition-colors duration-[var(--motion-fast)] ease-[var(--ease-fluid)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        "flex h-10 w-full items-center gap-2 rounded-[10px] px-3 text-sm text-muted-foreground transition-colors duration-[var(--motion-fast)] ease-[var(--ease-fluid)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}
