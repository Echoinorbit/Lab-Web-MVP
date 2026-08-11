"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import styles from "./Pagination.module.css";

interface PaginationProps {
  index: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  /** Dark pill variant used over the darker sections. */
  dark?: boolean;
  className?: string;
  style?: CSSProperties;
}

function Arrow({ back }: { back?: boolean }) {
  return (
    <svg
      className={styles.arrow}
      viewBox="0 0 18 27"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={back ? { transform: "translateY(-50%) rotate(180deg)" } : undefined}
      aria-hidden="true"
    >
      <path d="M4 3l11 10.5L4 24" />
    </svg>
  );
}

/**
 * Prev / next control with a current-position readout, shared by the notice
 * carousel. Rendered as the site's textured round buttons inside a pill.
 */
export function Pagination({
  index,
  count,
  onPrev,
  onNext,
  dark = false,
  className,
  style,
}: PaginationProps) {
  const atStart = index <= 0;
  const atEnd = index >= count - 1;

  return (
    <div
      className={cn(styles.pagination, styles.nav, dark && styles.dark, className)}
      style={style}
    >
      <button
        type="button"
        className={cn(styles.button, atStart && styles.disabled)}
        onClick={onPrev}
        disabled={atStart}
        aria-label="Previous"
      >
        <span className={styles.border} />
        <Arrow back />
      </button>

      <span className={styles.paginationNumber}>
        {index + 1} / {count}
      </span>

      <button
        type="button"
        className={cn(styles.button, atEnd && styles.disabled)}
        onClick={onNext}
        disabled={atEnd}
        aria-label="Next"
      >
        <span className={styles.border} />
        <Arrow />
      </button>
    </div>
  );
}
