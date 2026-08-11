"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Reveal trigger shared by 05-Gameplay and 08-AIC.
 *
 * The production build keeps most section furniture at `opacity: 0` in CSS and
 * fades it in from JavaScript once the section scrolls into view; this is the
 * clone's stand-in for that. Fires once, at the house threshold of 0.3.
 */
export function useInView<T extends HTMLElement>(
  threshold = 0.3,
): readonly [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            return;
          }
        }
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}
