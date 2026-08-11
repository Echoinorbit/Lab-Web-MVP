"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { operators as operatorData, t } from "@/content";
import { cn } from "@/lib/utils";
import { OperatorH5Panel } from "./OperatorH5Panel";
import { OperatorPcPanel } from "./OperatorPcPanel";
import { OperatorStage, type StageMode } from "./OperatorStage";
import { OperatorSwitcher } from "./OperatorSwitcher";
import { buildOperatorView } from "./operatorView";
import styles from "./OperatorSection.module.css";

/** Matches the reveal threshold used by every other section in the clone. */
const REVEAL_THRESHOLD = 0.3;

/**
 * 02-Operator — the operator browser.
 *
 * Click-driven, exactly like the original: picking an avatar (or an arrow)
 * selects that operator, the rail re-centres on it, the copy cross-fades and
 * the stage plays that operator's entrance clip once before looping the idle
 * clip. The 2D/3D control swaps the video stage for the still illustration.
 *
 * Landscape and portrait are two separate subtrees (`pcContainer` /
 * `h5Container`) toggled by the extract's own orientation media queries — the
 * site has no width breakpoints.
 */
export function OperatorSection() {
  const roster = operatorData.operators;
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<StageMode>("3d");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { threshold: REVEAL_THRESHOLD },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const select = useCallback(
    (next: number) => {
      if (roster.length === 0) return;
      const clamped = Math.min(Math.max(next, 0), roster.length - 1);
      setIndex(clamped);
    },
    [roster.length],
  );

  const toggleMode = useCallback(() => {
    setMode((current) => (current === "3d" ? "2d" : "3d"));
  }, []);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((current) => !current);
  }, []);

  const operator = roster[index];
  const view = useMemo(
    () => (operator ? buildOperatorView(operator, index, roster.length) : null),
    [operator, index, roster.length],
  );

  if (!view) return null;

  return (
    <section
      ref={rootRef}
      data-section="operator"
      className={cn(styles.section, inView && styles.inView)}
    >
      <div className={styles.sectionContainer}>
        <OperatorPcPanel view={view} mode={mode} onToggleMode={toggleMode} />

        <OperatorStage operator={view.operator} mode={mode} />

        <OperatorH5Panel
          view={view}
          mode={mode}
          drawerOpen={drawerOpen}
          onToggleMode={toggleMode}
          onToggleDrawer={toggleDrawer}
        />

        <div className={styles.illustLayer}>
          <div className={styles.switcher}>
            <OperatorSwitcher roster={roster} activeIndex={index} onSelect={select} />
          </div>
        </div>

        <a
          href="/operator"
          className={cn(styles.listButton, inView && styles.visible)}
        >
          {t("operator.more")}
        </a>
      </div>
    </section>
  );
}
