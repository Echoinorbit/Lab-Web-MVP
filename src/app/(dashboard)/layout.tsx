import type { ReactNode } from "react";

import { logout } from "@/features/auth";
import { Header } from "@/shared/components/layout/header";
import { MobileNav } from "@/shared/components/layout/mobile-nav";
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
      select: { displayName: true },
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    getUserPermissions(user.id),
  ]);
  const displayName = profile?.displayName ?? user.username;
  const navigationAccess = buildNavigationAccess(permissions);

  return (
    <div className="flex min-h-screen">
      <Sidebar access={navigationAccess} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center border-b px-2 md:hidden">
          <MobileNav access={navigationAccess} />
          <div className="px-2 text-sm font-semibold">实验室协作</div>
        </div>
        <Header displayName={displayName} role={user.role} unreadCount={unreadCount} logoutAction={logout} />
        <main className="mx-auto w-full max-w-7xl px-4 py-5">{children}</main>
      </div>
    </div>
  );
}
