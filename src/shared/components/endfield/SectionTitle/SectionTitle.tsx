"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import styles from "./SectionTitle.module.css";

interface SectionTitleProps {
  /** Latin title that slides out of the grey block, e.g. `"LORE"`. */
  titleEn: string;
  /** Localised title beneath the block, e.g. `"世界观资料"`. */
  titleCn: string;
  /** White text variant, used on the dark sections (03-Lore, 04-Information). */
  dark?: boolean;
  className?: string;
}

/**
 * The shared section heading used across every content section.
 *
 * On entering the viewport the grey `arrowBlock` slides in from the left, the
 * chevron rotates from -45deg to 0, and the two labels fade up. The CSS for the
 * block and chevron is the site's own; the label reveal is added here because
 * the original drives it from JS (both labels are `opacity: 0` in the CSS).
 */
export function SectionTitle({
  titleEn,
  titleCn,
  dark = false,
  className,
}: SectionTitleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(styles.sectionTitle, dark && styles.dark, className)}
    >
      <svg className={styles.icon} viewBox="0 0 120 6" aria-hidden="true">
        <rect width="120" height="6" fill="currentColor" />
      </svg>

      <div className={cn(styles.arrowBlock, active && styles.active)}>
        <div className={styles.inner}>
          <svg className={styles.arrow} viewBox="0 0 18 23" aria-hidden="true">
            <path
              d="M4 2 L14 11.5 L4 21"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            />
          </svg>
          <span
            className={styles.titleEn}
            style={active ? { opacity: 1, transition: "opacity .5s ease .35s" } : undefined}
          >
            {titleEn}
          </span>
        </div>
      </div>

      <div
        className={styles.titleCn}
        style={active ? { opacity: 1, transition: "opacity .5s ease .5s" } : undefined}
      >
        {titleCn}
      </div>
    </div>
  );
}
