"use client";

import { useEffect, useState } from "react";

export function useScrollSpy(sections: readonly string[]) {
  const [active, setActive] = useState(sections[0] ?? "");

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const midpoint = window.innerHeight / 2;
      const current = sections.find((id) => {
        const node = document.querySelector<HTMLElement>(`[data-section="${id}"]`);
        if (!node) return false;
        const { top, bottom } = node.getBoundingClientRect();
        return top <= midpoint && bottom > midpoint;
      });
      if (!current) return;
      setActive((previous) => {
        if (previous === current) return previous;
        const hash = `#${current}`;
        if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
        return current;
      });
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  return active;
}

export function scrollToSection(id: string) {
  document.querySelector<HTMLElement>(`[data-section="${id}"]`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}
