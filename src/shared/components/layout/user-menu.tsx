"use client";

import { LogOut, RefreshCw, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { Avatar } from "@/shared/components/ui/avatar";
import { cn } from "@/shared/lib/utils";

type UserMenuProps = {
  displayName: string;
  avatar: string | null;
  role: "ADMIN" | "MEMBER";
  logoutAction: () => void | Promise<void>;
};

const roleLabels: Record<UserMenuProps["role"], string> = {
  ADMIN: "管理员",
  MEMBER: "成员",
};

export function UserMenu({ displayName, avatar, role, logoutAction }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
        className="ui-pressable flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-transparent text-sm font-semibold text-foreground transition-[transform,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)] active:scale-[0.97] hover:ring-1 hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:active:scale-100"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="个人菜单"
      >
        <Avatar src={avatar} name={displayName} size={40} className="ring-1 ring-border/70" priority />
      </button>

      <div
        role="menu"
        data-state={open ? "open" : "closed"}
        aria-hidden={!open}
        inert={!open}
        className="ui-material ui-popover absolute right-0 top-12 z-40 w-64 origin-top-right rounded-2xl border border-white/55 p-1.5 shadow-[var(--shadow-popover)] dark:border-white/10"
      >
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar src={avatar} name={displayName} size={36} priority />
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
          className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        "flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm text-muted-foreground transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}
