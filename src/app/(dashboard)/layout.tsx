import type { ReactNode } from "react";

import { logout } from "@/features/auth";
import { Header } from "@/shared/components/layout/header";
import { Sidebar } from "@/shared/components/layout/sidebar";
import { buildNavigationAccess } from "@/shared/lib/navigation-access";
import { getUserPermissions } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireActiveUser();
  const [profile, unreadCount, permissions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { displayName: true, avatar: true },
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    getUserPermissions(user.id),
  ]);
  const displayName = profile?.displayName ?? user.username;
  const navigationAccess = buildNavigationAccess(permissions);

  return (
    <div className="flex min-h-screen bg-transparent">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[70] -translate-y-20 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background focus:translate-y-0"
      >
        跳到主要内容
      </a>
      <Sidebar access={navigationAccess} />
      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Header
          displayName={displayName}
          avatar={profile?.avatar ?? null}
          role={user.role}
          unreadCount={unreadCount}
          navigationAccess={navigationAccess}
          logoutAction={logout}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto min-w-0 w-full max-w-[1560px] px-4 pb-16 pt-8 outline-none sm:px-7 sm:pt-10 lg:px-10 lg:pb-24 lg:pt-14 xl:px-14 2xl:px-16"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
