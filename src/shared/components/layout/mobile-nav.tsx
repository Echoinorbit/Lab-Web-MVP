"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Sidebar } from "@/shared/components/layout/sidebar";
import { Button } from "@/shared/components/ui/button";
import type { NavigationAccessMap } from "@/shared/lib/navigation-access";

export function MobileNav({ access }: { access: NavigationAccessMap }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="打开导航"
        aria-controls="mobile-navigation"
        aria-expanded={open}
      >
        <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
      </Button>

      {open ? (
        <div className="ui-overlay-enter fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            aria-label="关闭导航"
          />
          <section
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="移动导航"
            className="ui-sheet-enter relative h-full w-[min(88vw,304px)] border-r border-border bg-card"
          >
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-10"
              onClick={() => setOpen(false)}
              aria-label="关闭导航"
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </Button>
            <Sidebar className="block h-full w-full overflow-y-auto border-r-0" access={access} />
          </section>
        </div>
      ) : null}
    </div>
  );
}
