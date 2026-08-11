"use client";

import { useEffect, useState } from "react";
import type { SectionId } from "@/types/site";

/**
 * Tracks which `[data-section]` element currently owns the viewport and mirrors
 * it into `location.hash`, the way the original site does.
 *
 * The original picks the section covering the vertical midpoint rather than the
 * first intersecting one, so tall sections (09-Calendar spans ~2.4 screens) stay
 * active for their whole run.
 */
export function useScrollSpy(sections: readonly SectionId[]): SectionId {
  const [active, setActive] = useState<SectionId>(sections[0]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const midpoint = window.innerHeight / 2;
      let current: SectionId | null = null;

      for (const id of sections) {
        const node = document.querySelector<HTMLElement>(
          `[data-section="${id}"]`,
        );
        if (!node) continue;
        const { top, bottom } = node.getBoundingClientRect();
        if (top <= midpoint && bottom > midpoint) {
          current = id;
          break;
        }
      }

      if (current && current !== active) {
        setActive(current);
        const hash = `#${current}`;
        if (window.location.hash !== hash) {
          window.history.replaceState(null, "", hash);
        }
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections, active]);

  return active;
}

/** Smooth-scrolls a `[data-section]` element into view. */
export function scrollToSection(id: SectionId) {
  document
    .querySelector<HTMLElement>(`[data-section="${id}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
