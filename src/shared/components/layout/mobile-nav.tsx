"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Sidebar } from "@/shared/components/layout/sidebar";
import type { NavigationAccessMap } from "@/shared/lib/navigation-access";

export function MobileNav({ access }: { access: NavigationAccessMap }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <Button variant="ghost" className="h-9 w-9 px-0" onClick={() => setOpen(true)} aria-label="打开导航">
        <Menu className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur" onClick={() => setOpen(false)}>
          <Sidebar className="block h-full" access={access} />
        </div>
      ) : null}
    </div>
  );
}
