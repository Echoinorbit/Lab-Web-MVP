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
      select: { displayName: true },
    }),
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    getUserPermissions(user.id),
  ]);
  const displayName = profile?.displayName ?? user.username;
  const navigationAccess = buildNavigationAccess(permissions);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar access={navigationAccess} />
      <div className="min-w-0 flex-1 overflow-x-hidden">
        <Header
          displayName={displayName}
          role={user.role}
          unreadCount={unreadCount}
          navigationAccess={navigationAccess}
          logoutAction={logout}
        />
        <main className="mx-auto min-w-0 w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
