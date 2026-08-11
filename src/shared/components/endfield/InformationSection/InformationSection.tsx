"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/content";
import {
  MEDIA_CATEGORIES,
  backgroundVideoUrl,
  categoryLabel,
  mediaItems,
  type MediaItem,
} from "@/content/media";
import type { MediaCategory } from "@/types/site";
import { cn } from "@/lib/utils";
import { Button } from "@/components/Button/Button";
import { MediaModal } from "@/components/MediaModal/MediaModal";
import { SectionTitle } from "@/components/SectionTitle/SectionTitle";
import styles from "./InformationSection.module.css";

/** `.coverBox` width from the extract — the carousel step. */
const CARD_WIDTH_REM = 33.75;

/**
 * 04-Information — the media / PV section.
 *
 * A full-viewport dark panel with a muted looping background video, the shared
 * section heading, a category filter and a horizontal carousel of trailer
 * cards. The centred card is the active one; selecting it (or the yellow play
 * button) opens {@link MediaModal} and fades the background video out so the
 * two clips never fight each other.
 */
export function InformationSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);

  const [inView, setInView] = useState(false);
  const [category, setCategory] = useState<MediaCategory>(MEDIA_CATEGORIES[0]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState<MediaItem | null>(null);

  const items = useMemo(
    () => mediaItems.filter((item) => item.category === category),
    [category],
  );

  const current = items[index] ?? items[0];
  const prev = index > 0 ? items[index - 1] : undefined;
  const next = index < items.length - 1 ? items[index + 1] : undefined;

  // Section entrance.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Pause the ambience loop while a trailer plays, resume afterwards.
  useEffect(() => {
    const video = bgVideoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
    } else {
      void video.play().catch(() => {
        /* Autoplay can be refused before the first interaction; harmless. */
      });
    }
  }, [playing]);

  const selectCategory = useCallback((nextCategory: MediaCategory) => {
    setCategory(nextCategory);
    setIndex(0);
  }, []);

  const step = useCallback(
    (delta: number) => {
      setIndex((value) =>
        Math.min(Math.max(value + delta, 0), items.length - 1),
      );
    },
    [items.length],
  );

  const openCard = useCallback(
    (item: MediaItem, position: number) => {
      if (position === index) {
        setPlaying(item);
      } else {
        setIndex(position);
      }
    },
    [index],
  );

  const closeModal = useCallback(() => setPlaying(null), []);

  // Centre the active card inside the 96.1875rem window.
  const trackOffset = ((items.length - 1) / 2 - index) * CARD_WIDTH_REM;

  return (
    <section
      ref={sectionRef}
      id="information"
      data-section="information"
      className={cn(styles.sectionContainer, inView && styles.inView)}
    >
      <div className={styles.bgVideo}>
        <video
          ref={bgVideoRef}
          className={cn(playing && styles.fadeOut)}
          src={backgroundVideoUrl}
          poster={mediaItems[mediaItems.length - 1]?.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      </div>

      <SectionTitle
        className={styles.sectionTitle}
        titleEn="INFORMATION"
        titleCn={t("section.information")}
        dark
      />

      <div className={styles.decoLine} />

      { }
      <img
        className={styles.blurredLogo}
        src="/images/blurred_logo.eccbe4f3.png"
        alt=""
        aria-hidden="true"
      />

      <div className={styles.infoVideos}>
        <div
          className={styles.infoVideoListFallback}
          style={{ transform: `translateX(${trackOffset}rem)` }}
        >
          {items.map((item, position) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                styles.infoVideo,
                position === index && styles.active,
              )}
              onClick={() => openCard(item, position)}
              aria-label={item.title}
              aria-current={position === index}
            >
              <span className={styles.coverBox}>
                { }
                <img src={item.poster} alt="" />
                <span className={styles.mask} />
              </span>
            </button>
          ))}
        </div>

        <div className={styles.navContainer}>
          {prev ? (
            <div className={cn(styles.navInfo, styles.prev)}>
              {prev.date}
              <span className={styles.tag}>{prev.categoryLabel}</span>
            </div>
          ) : null}

          {next ? (
            <div className={cn(styles.navInfo, styles.next)}>
              <span className={styles.tag}>{next.categoryLabel}</span>
              {next.date}
            </div>
          ) : null}

          <button
            type="button"
            className={cn(styles.navBtn, styles.prev)}
            onClick={() => step(-1)}
            disabled={!prev}
            aria-label="Previous video"
          />
          <button
            type="button"
            className={cn(styles.navBtn, styles.next)}
            onClick={() => step(1)}
            disabled={!next}
            aria-label="Next video"
          />
        </div>
      </div>

      <div className={styles.infoCurrent}>
        <div className={styles.categoryTabs} role="tablist">
          {MEDIA_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={value === category}
              className={cn(
                styles.categoryTab,
                value === category && styles.active,
              )}
              onClick={() => selectCategory(value)}
            >
              {categoryLabel(value)}
            </button>
          ))}
        </div>

        <div className={styles.tagAndDate}>
          <span className={styles.tag}>{current?.categoryLabel}</span>
          <span className={styles.date}>{current?.date}</span>
        </div>

        <div className={styles.title}>
          <div className={styles.titleInner}>
            <div className={styles.titleTextLandscape}>{current?.title}</div>
          </div>
        </div>

        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.playBtn}
            onClick={() => current && setPlaying(current)}
            aria-label="Play trailer"
          />
          <Button
            className={styles.button}
            onClick={() => current && setPlaying(current)}
          >
            {t("information.more")}
          </Button>
        </div>
      </div>

      <MediaModal item={playing} onClose={closeModal} />
    </section>
  );
}
