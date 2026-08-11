"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import styles from "./CodePrinter.module.css";

interface CodePrinterProps {
  /** Positioning class from the owning section, e.g. `styles.codePrinter`. */
  className?: string;
  /** Strings the readout cycles through, one line at a time. */
  lines: readonly string[];
  /** How many finished lines stay on screen above the one being typed. */
  history?: number;
}

const TYPE_MS = 45;
const HOLD_MS = 1600;

/**
 * The terminal-style readout that sits under `.decoLeft`.
 *
 * Types one technical string at a time, keeps the last few finished lines
 * above it, then wraps around. The caret pulses on the shared `ef-flashing`
 * keyframe from globals.css.
 */
export function CodePrinter({ className, lines, history = 2 }: CodePrinterProps) {
  const [row, setRow] = useState(0);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (lines.length === 0) return;

    const full = lines[row % lines.length];

    if (typed.length < full.length) {
      const id = window.setTimeout(
        () => setTyped(full.slice(0, typed.length + 1)),
        TYPE_MS,
      );
      return () => window.clearTimeout(id);
    }

    const id = window.setTimeout(() => {
      setTyped("");
      setRow((value) => value + 1);
    }, HOLD_MS);
    return () => window.clearTimeout(id);
  }, [lines, row, typed]);

  const past: string[] = [];
  for (let i = Math.max(0, row - history); i < row; i++) {
    past.push(lines[i % lines.length]);
  }

  return (
    <div className={cn(styles.codePrinter, className)} aria-hidden="true">
      {Array.from({ length: history }, (_, slot) => {
        const line = past[past.length - history + slot];
        return (
          <span key={slot} className={cn(styles.row, styles.past)}>
            {line ? (
              <>
                <span className={styles.prompt}>&gt;</span>
                {line}
              </>
            ) : null}
          </span>
        );
      })}
      <span className={styles.row}>
        <span className={styles.prompt}>&gt;</span>
        {typed}
        <span className={styles.caret}>_</span>
      </span>
    </div>
  );
}
