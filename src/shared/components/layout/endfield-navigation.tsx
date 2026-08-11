"use client";

import {
  Bell,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import headerStyles from "@/shared/components/endfield/Header/Header.module.css";
import { images } from "@/shared/lib/images";
import type { NavigationAccessMap } from "@/shared/lib/navigation-access";
import { cn } from "@/shared/lib/utils";

type NavigationProps = {
  navigationAccess: NavigationAccessMap;
  unreadCount: number;
  logoutAction: () => void | Promise<void>;
};

const items = [
  { key: "home", href: "/dashboard", label: "总览", Icon: LayoutDashboard },
  { key: "projects", href: "/projects", label: "项目", Icon: FolderKanban },
  { key: "progress", href: "/progress", label: "进度", Icon: ClipboardList },
  { key: "posts", href: "/posts", label: "帖子", Icon: MessageSquare },
  { key: "announcements", href: "/announcements", label: "公告", Icon: Megaphone },
  { key: "notifications", href: "/notifications", label: "通知", Icon: Bell },
  { key: "profile", href: "/profile", label: "档案", Icon: UserRound },
  { key: "admin", href: "/admin", label: "治理", Icon: ShieldCheck },
] as const;

const workspaceSectionIds = ["home", "projects", "progress", "posts", "announcements", "notifications", "profile","admin"] as const;
type WorkspaceSectionId = (typeof workspaceSectionIds)[number];
const NAV_TOP_OFFSET_REM = 8; //改左侧导航栏宽和高的 46和47
const NAV_ITEM_STRIDE_REM = 5;

function isWorkspaceSectionId(key: string): key is WorkspaceSectionId {
  return workspaceSectionIds.includes(key as WorkspaceSectionId);
}

export function EndfieldNavigation({ navigationAccess, unreadCount, logoutAction }: NavigationProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailActive, setDetailActive] = useState(false);
  const [activeSection, setActiveSection] = useState<WorkspaceSectionId>("home");
  const visibleItems = items.filter(({ key }) => key === "profile" || key === "admin"
    ? key === "profile" || Object.entries(navigationAccess).some(([accessKey, allowed]) => accessKey.startsWith("admin-") && allowed)
    : navigationAccess[key]);
  const mobileItems = visibleItems.filter(({ key }) => key !== "profile");
  const isWorkspaceRoute = pathname === "/" || pathname === "/dashboard";
  const activeKey = isWorkspaceRoute
    ? activeSection
    : visibleItems.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`))?.key;
  const activeIndex = Math.max(0, visibleItems.findIndex(({ key }) => key === activeKey));

  useEffect(() => {
    if (!isWorkspaceRoute) return;

    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      const probe = window.innerHeight * 0.25;
      const section = workspaceSectionIds.find((id) => {
        const element = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
        if (!element) return false;
        const { top, bottom } = element.getBoundingClientRect();
        return top <= probe && bottom > probe;
      });
      if (section) setActiveSection(section);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [isWorkspaceRoute]);

  const links = visibleItems.map(({ key, href, label, Icon }, index) => {
    const active = key === activeKey;
    const destination = (isWorkspaceSectionId(key) ? `/#${key}` : href) as Route;
    const suffix = key === "notifications" && unreadCount > 0 ? ` · ${unreadCount > 99 ? "99+" : unreadCount}` : "";
    return (
      <Link
        key={key}
        href={destination}
        className={cn(headerStyles.navItem, active && headerStyles.active)}
        style={{ transform: `translate3d(0, ${NAV_TOP_OFFSET_REM + index * NAV_ITEM_STRIDE_REM}rem, 0)` }}
        aria-current={active ? "location" : undefined}
      >
        <Icon className={headerStyles.icon} aria-hidden="true" />
        <span className={headerStyles.textWrapper}>{label}{suffix}</span>
      </Link>
    );
  });

  return (
    <>
      <aside
        className={cn(headerStyles.pcHeaderContainer, headerStyles.workbenchHeader, detailActive && headerStyles.detailActive)}
        aria-label="主导航"
        onMouseEnter={() => setDetailActive(true)}
        onMouseLeave={() => setDetailActive(false)}
        onFocus={() => setDetailActive(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setDetailActive(false);
        }}
      >
        <div className={headerStyles.innerContainer}>
          <Link href="/dashboard" aria-label="实验室协作总览">
            <img className={headerStyles.logo} src={images.brandMark} alt="" />
          </Link>
          <span
            className={headerStyles.overlay}
            style={{ transform: `translate3d(0, ${NAV_TOP_OFFSET_REM - 0.25 + activeIndex * NAV_ITEM_STRIDE_REM}rem, 0)` }}
          />
          <nav className={headerStyles.navList}>{links}</nav>
          <div className={cn(headerStyles.buttonFrameContainer, headerStyles.ele2)}>
            <form action={logoutAction} className={headerStyles.logoutForm}>
              <button className={headerStyles.button} type="submit" aria-label="退出登录">
                <LogOut className={headerStyles.icon} aria-hidden="true" />
                <span className={headerStyles.textWrapper}>退出登录</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className={headerStyles.h5HeaderContainer}>
        <Link href="/dashboard" aria-label="实验室协作总览">
          <img className={headerStyles.logo} src={images.brandMark} alt="" />
        </Link>
        <button
          type="button"
          className={headerStyles.menuIcon}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "关闭导航" : "打开导航"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
        <div className={cn(headerStyles.h5Menu, menuOpen && headerStyles.active)} aria-hidden={!menuOpen} inert={!menuOpen}>
          <nav className={headerStyles.navList} aria-label="主导航">
            {mobileItems.map(({ key, href, label, Icon }) => {
              const active = key === activeKey;
              const destination = (isWorkspaceSectionId(key) ? `/#${key}` : href) as Route;
              return (
                <Link
                  key={key}
                  href={destination}
                  className={cn(headerStyles.menuItem, active && headerStyles.active)}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "location" : undefined}
                >
                  <Icon className={headerStyles.icon} aria-hidden="true" />
                  <span className={headerStyles.divider} />
                  <span className={headerStyles.text}>{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className={headerStyles.menuBottomButtons}>
            <form action={logoutAction}>
              <button className={headerStyles.button} type="submit">
                <LogOut className={headerStyles.icon} aria-hidden="true" />
                <span className={headerStyles.text}>退出登录</span>
              </button>
            </form>
          </div>
        </div>
      </header>
    </>
  );
}
