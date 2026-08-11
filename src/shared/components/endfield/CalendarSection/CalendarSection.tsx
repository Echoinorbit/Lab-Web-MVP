"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/content";
import styles from "./CalendarSection.module.css";

/**
 * The version calendar ships as pre-rendered artwork rather than markup, keyed
 * in the bundle as `calendar.title` / `calendar.timeline` / `calendar.content`.
 * These are the zh-cn variants, resolved from the locale block of the
 * production bundle. There is no separate portrait asset — `.calendar` and
 * `.calendarH5` share `calendar.content` and differ only in CSS sizing.
 */
const CALENDAR_TITLE = "/images/title.bc8e821f.png";
const CALENDAR_TIMELINE = "/images/timeline.711f80a1.png";
const CALENDAR_CONTENT = "/images/content.a0b657b6.jpg";

/** Reveals each element once it scrolls past, rather than all at section entry. */
function useStaggeredReveal(count: number) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [shown, setShown] = useState<boolean[]>(() =>
    Array.from({ length: count }, () => false),
  );

  useEffect(() => {
    const nodes = refs.current.filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = nodes.indexOf(entry.target as HTMLElement);
          if (i >= 0) {
            setShown((prev) => {
              if (prev[i]) return prev;
              const next = [...prev];
              next[i] = true;
              return next;
            });
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1 },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [count]);

  return { refs, shown };
}

const REVEAL = "opacity .7s ease, transform .7s ease";

/**
 * 09-Calendar — the version roadmap and the tallest section on the page.
 *
 * Landscape and portrait render different subtrees: `.calendar` is one tall
 * image at 141.375rem wide, while `.calendarScroll` wraps `.calendarH5` in a
 * fixed 128rem scroll well. Each is `display: none` in the other orientation,
 * so both are rendered and the extract's own media queries pick one.
 *
 * All three pieces are `<img>` rather than background-image divs: the extract
 * sizes them with `height: auto`, so as empty divs they collapse to zero.
 */
export function CalendarSection() {
  const { refs, shown } = useStaggeredReveal(3);

  const assign = (i: number) => (node: HTMLElement | null) => {
    refs.current[i] = node;
  };

  const reveal = (i: number, delay = 0) =>
    shown[i]
      ? {
          opacity: 1,
          transform: "translate3d(0,0,0)",
          transition: delay ? `${REVEAL} ${delay}s` : REVEAL,
        }
      : undefined;

  return (
    <section
      id="calendar"
      data-section="calendar"
      className={styles.sectionContainer}
      aria-label={t("nav.calendar")}
    >
      <div className={styles.calendarContainer}>
        <img
          ref={assign(0)}
          className={styles.title}
          src={CALENDAR_TITLE}
          alt={t("nav.calendar")}
          style={reveal(0)}
        />

        <img
          ref={assign(1)}
          className={styles.timeline}
          src={CALENDAR_TIMELINE}
          alt=""
          style={reveal(1, 0.1)}
        />

        {/* Landscape */}
        <img
          ref={assign(2)}
          className={styles.calendar}
          src={CALENDAR_CONTENT}
          alt=""
          style={reveal(2, 0.2)}
        />

        {/* Portrait */}
        <div className={styles.calendarScroll} style={reveal(2, 0.2)}>
          <div className={styles.scrollContainer}>
            <div className={styles.content}>
              <img className={styles.calendarH5} src={CALENDAR_CONTENT} alt="" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
