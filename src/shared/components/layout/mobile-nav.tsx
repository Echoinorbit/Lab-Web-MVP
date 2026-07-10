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
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable.at(-1) ?? first;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerButtonRef.current?.focus();
    };
  }, [open]);

  return (
    <div className="xl:hidden">
      <Button
        ref={triggerButtonRef}
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
            ref={dialogRef}
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
