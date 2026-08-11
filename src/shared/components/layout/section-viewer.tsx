import type { ReactNode } from "react";

import styles from "@/shared/components/endfield/SectionViewer/SectionViewer.module.css";
import type { NavigationAccessMap } from "@/shared/lib/navigation-access";

import { EndfieldNavigation } from "./endfield-navigation";

type SectionViewerProps = {
  children: ReactNode;
  navigationAccess: NavigationAccessMap;
  unreadCount: number;
  logoutAction: () => void | Promise<void>;
};

export function SectionViewer({ children, navigationAccess, unreadCount, logoutAction }: SectionViewerProps) {
  return (
    <div className={styles.sectionViewer}>
      <div className={styles.header}>
        <EndfieldNavigation
          navigationAccess={navigationAccess}
          unreadCount={unreadCount}
          logoutAction={logoutAction}
        />
      </div>
      <main id="main-content" tabIndex={-1} className={styles.contentContainer}>
        {children}
      </main>
      <div className={styles.modalLayer} aria-live="polite" />
    </div>
  );
}
