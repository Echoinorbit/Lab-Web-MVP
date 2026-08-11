"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { PaginationArrow } from "./SectionDeco";
import { useInView } from "./useInView";
import styles from "./GameplayAlbum.module.css";

export interface AlbumItem {
  /** Localised item title, from `tItems(...)`. */
  title: string;
  /** Localised item copy, from `tItems(...)`. */
  description: string;
  /** Playable URL for the item's clip (05-Gameplay). */
  video?: string;
  /** Still frame for the item (08-AIC). */
  image?: string;
}

interface GameplayAlbumProps {
  /** Which of the two layouts in the extract to use. */
  variant: "gameplay" | "aic";
  /** Latin label printed down the yellow blade, e.g. `"GAMEPLAY"`. */
  titleEn: string;
  items: readonly AlbumItem[];
  index: number;
  onSelect: (index: number) => void;
}

const AK_MARK = "ARKNIGHTS: ENDFIELD";

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * The media stage shared by 05-Gameplay and 08-AIC: a wide frame with a yellow
 * (AIC: light grey) blade down one edge, the current item's clip or diagram,
 * a pagination puck, and the item's title/description underneath.
 *
 * Selection is click-driven — prev/next or a carousel cell — and swapping items
 * cross-fades the media layers so the yellow duotone plate underneath never
 * flashes through.
 */
export function GameplayAlbum({
  variant,
  titleEn,
  items,
  index,
  onSelect,
}: GameplayAlbumProps) {
  const [paginationRef, inView] = useInView<HTMLDivElement>();
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [shown, setShown] = useState({ current: index, previous: index });

  // Adjusting during render (rather than in an effect) keeps the outgoing clip
  // and the incoming one on screen together for the cross-fade, without the
  // extra commit an effect would cost.
  if (shown.current !== index) {
    setShown({ current: index, previous: shown.current });
  }

  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === index) {
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [index]);

  const active = items[index];
  const total = items.length;
  const step = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= total) return;
    onSelect(next);
  };

  return (
    <div className={cn(styles.gameplayAlbum, styles[variant])}>
      <svg className={styles.filterDefs} aria-hidden="true" focusable="false">
        <defs>
          {/*
            `.image .middle` filters through `url(#red-green)`; the production
            page defines it as a duotone that lands on #191919 / #fffa00.
          */}
          <filter id="red-green" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.098
                      0.98 0 0 0 0.098
                      0 0 0 0 0.098
                      0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>

      <div className={styles.imageContainer}>
        <div className={styles.image}>
          <div className={styles.wrapper}>
            <div className={styles.bottom} />
            <div className={styles.middle} />
            {items.map((item, i) => (
              <div
                key={item.title}
                className={cn(
                  styles.top,
                  styles.layer,
                  i === shown.current && styles.visible,
                  i === shown.previous && i !== shown.current && styles.beneath,
                )}
              >
                <div className={styles.videoContainer}>
                  {item.video ? (
                    <video
                      ref={(node) => {
                        videoRefs.current[i] = node;
                      }}
                      src={item.video}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />
                  ) : null}
                  {item.image ? <img src={item.image} alt="" /> : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.rightDeco}>
          <div className={styles.line}>
            <span className={styles.ak}>{AK_MARK}</span>
            <span className={styles.title}>{titleEn}</span>
            <img className={styles.deco} src="/images/deco.dbe18bea.svg" alt="" />
          </div>
        </div>
      </div>

      <div
        ref={paginationRef}
        className={cn(styles.pagination, styles.pgn, inView && styles.inView)}
      >
        <button
          type="button"
          className={cn(styles.button, index === 0 && styles.disabled)}
          onClick={() => step(-1)}
          aria-label="上一项"
        >
          <span className={styles.border} />
          <PaginationArrow className={styles.arrow} />
        </button>

        <div className={styles.carousel} style={{ width: `${total * 2.5}rem` }}>
          {items.map((item, i) => (
            <button
              key={item.title}
              type="button"
              className={cn(styles.block, i === index && styles.active)}
              style={{ transform: `translateX(${i * 2.5}rem)` }}
              onClick={() => onSelect(i)}
              aria-label={item.title}
              aria-current={i === index}
            >
              {pad(i + 1)}
            </button>
          ))}
        </div>

        <button
          type="button"
          className={cn(styles.button, index === total - 1 && styles.disabled)}
          onClick={() => step(1)}
          aria-label="下一项"
        >
          <span className={styles.border} />
          <PaginationArrow className={cn(styles.arrow, styles.right)} />
        </button>
      </div>

      <div className={styles.detail}>
        <span className={styles.index}>{pad(index + 1)}</span>
        <div key={`title-${index}`} className={cn(styles.title, styles.swap)}>
          {active ? active.title : ""}
        </div>
        <div className={styles.descriptionContainer}>
          <p key={`copy-${index}`} className={cn(styles.description, styles.swap)}>
            {active ? active.description : ""}
          </p>
        </div>
      </div>

      <div className={styles.paginationH5}>
        <div className={cn(styles.pgn, styles.nav)}>
          <button
            type="button"
            className={cn(styles.button, index === 0 && styles.disabled)}
            onClick={() => step(-1)}
            aria-label="上一项"
          >
            <span className={styles.border} />
            <PaginationArrow className={styles.arrow} />
          </button>
          <span className={styles.paginationNumber}>
            <span>{pad(index + 1)}</span>
            <span className={styles.divider}>/</span>
            <span>{pad(total)}</span>
          </span>
          <button
            type="button"
            className={cn(styles.button, index === total - 1 && styles.disabled)}
            onClick={() => step(1)}
            aria-label="下一项"
          >
            <span className={styles.border} />
            <PaginationArrow className={cn(styles.arrow, styles.right)} />
          </button>
        </div>
      </div>
    </div>
  );
}
