import type { ReactNode } from "react";

import { logout } from "@/features/auth";
import { SectionViewer } from "@/shared/components/layout/section-viewer";
import { buildNavigationAccess } from "@/shared/lib/navigation-access";
import { getUserPermissions } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireActiveUser();
  const [unreadCount, permissions] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    getUserPermissions(user.id),
  ]);
  const navigationAccess = buildNavigationAccess(permissions);

  return (
    <SectionViewer
      navigationAccess={navigationAccess}
      unreadCount={unreadCount}
      logoutAction={logout}
    >
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[110] -translate-y-20 bg-foreground px-4 py-2 text-sm font-medium text-background focus:translate-y-0"
      >
        跳到主要内容
      </a>
      {children}
    </SectionViewer>
  );
}
