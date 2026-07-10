"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Sidebar } from "@/shared/components/layout/sidebar";
import type { NavigationAccessMap } from "@/shared/lib/navigation-access";

export function MobileNav({ access }: { access: NavigationAccessMap }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="md:hidden">
      <Button variant="ghost" className="h-10 w-10 px-0" onClick={() => setOpen(true)} aria-label="打开导航">
        <Menu className="h-[18px] w-[18px]" />
      </Button>
      {open ? (
        <div className="ui-overlay-enter fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="ui-sheet-enter h-full w-64" onClick={(event) => event.stopPropagation()}>
            <Sidebar className="block h-full bg-background shadow-[var(--shadow-card)]" access={access} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
