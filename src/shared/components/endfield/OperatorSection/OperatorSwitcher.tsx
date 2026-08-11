"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import type { Operator } from "@/types/site";
import { RailArrowIcon, ReticleIcon } from "./OperatorIcons";
import styles from "./OperatorSection.module.css";

/** Emphasis applied to the selected avatar; every other item stays at 1. */
const ACTIVE_SCALE = 1.15;

interface OperatorSwitcherProps {
  roster: Operator[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

/**
 * The rail of circular avatars. Every item is absolutely positioned and offset
 * from the centre of the masked track by `--ef-op-offset`, so the selected
 * operator always sits in the middle and the rail slides under it — vertically
 * in landscape, horizontally in portrait.
 */
export function OperatorSwitcher({
  roster,
  activeIndex,
  onSelect,
}: OperatorSwitcherProps) {
  const atStart = activeIndex <= 0;
  const atEnd = activeIndex >= roster.length - 1;

  return (
    <div className={styles.operatorSwitcher}>
      <button
        type="button"
        aria-label="Previous operator"
        disabled={atStart}
        onClick={() => onSelect(activeIndex - 1)}
        className={cn(styles.button, styles.top, atStart && styles.disabled)}
      >
        <span className={styles.border} />
        <RailArrowIcon className={styles.arrow} />
      </button>

      <div className={styles.itemContainer}>
        {roster.map((operator, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={operator.key}
              type="button"
              aria-label={operator.name}
              aria-pressed={active}
              onClick={() => onSelect(index)}
              className={cn(styles.switchItem, active && styles.active)}
              style={
                {
                  "--ef-op-offset": index - activeIndex,
                  "--ef-op-scale": active ? ACTIVE_SCALE : 1,
                } as CSSProperties
              }
            >
              <ReticleIcon className={styles.activeBg} />
              <span className={styles.border} />
              <span className={styles.image} data-key={operator.visualKey ?? operator.key} />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="Next operator"
        disabled={atEnd}
        onClick={() => onSelect(activeIndex + 1)}
        className={cn(styles.button, styles.bottom, atEnd && styles.disabled)}
      >
        <span className={styles.border} />
        <RailArrowIcon className={styles.arrow} />
      </button>
    </div>
  );
}
