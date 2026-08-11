"use client";

import { useState } from "react";
import { Button } from "@/components/Button/Button";
import { t } from "@/content";
import { cn } from "@/lib/utils";
import type { BulletinItem } from "@/types/site";
import styles from "./NoticeSection.module.css";
import { Pagination } from "./Pagination";

/** Card width 55rem plus the carousel's gap, in rem. */
const STEP_REM = 57;

const TAB_LABELS: Record<BulletinItem["tab"], string> = {
  notices: "notice.tab.notices",
  news: "notice.tab.news",
  events: "notice.tab.events",
};

/**
 * Per-tab cover art, used when an item has no `cover`. The target does the same
 * via its `bulletin.<tab>` image keys.
 */
const TAB_FALLBACK: Record<BulletinItem["tab"], string> = {
  notices: "/images/notices.2c21bbe2.jpg",
  news: "/images/news.444ef4f7.jpg",
  events: "/images/events.debe45a3.jpg",
};

/** `displayTime` is unix seconds; the site renders it as YYYY.MM.DD. */
function formatDate(seconds: number): string {
  const d = new Date(seconds * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

interface NoticeCarouselProps {
  items: BulletinItem[];
}

/**
 * Landscape notice carousel.
 *
 * `.carouselContainer` is a 152.5rem masked viewport holding the 55rem
 * `.noticeItem` cards; `.carouselContentContainer` is the separate detail panel
 * for whichever card is active. (Portrait uses a different subtree entirely —
 * `.h5ContentContainer` with `.bulletinItem` cards two to a page.)
 */
export function NoticeCarousel({ items }: NoticeCarouselProps) {
  const [index, setIndex] = useState(0);
  const count = Math.max(items.length, 1);
  const active = items[index];

  return (
    <>
      <div className={styles.carouselContainer}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "2rem",
            // The cards do not sit at the carousel's top edge — measured
            // against the live section they start 13.4rem down, which is what
            // clears the detail line above them.
            paddingTop: "13.4rem",
            transform: `translate3d(-${index * STEP_REM}rem, 0, 0)`,
            transition: "transform .5s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          {items.map((item, i) => (
            <a
              key={item.cid}
              className={cn(styles.noticeItem, i === index && styles.active)}
              href={`https://endfield.hypergryph.com/news/${item.cid}`}
              target="_blank"
              rel="noreferrer"
              onMouseEnter={() => setIndex(i)}
              style={{
                // .noticeItem is a fixed 55rem card; without this the flex row
                // shrinks every card to a sliver.
                flexShrink: 0,
                // Inactive cards sit lower and dimmed, as on the target.
                transform: i === index ? undefined : "translate3d(0, 2.8rem, 0)",
                filter: i === index ? undefined : "brightness(.72)",
                transition: "transform .4s ease, filter .4s ease",
              }}
            >
              <img
                className={styles.image}
                src={item.cover || TAB_FALLBACK[item.tab]}
                alt={item.title}
                loading="lazy"
                // The CDN hotlink-blocks requests carrying a localhost referer,
                // so covers 403 in the browser even though they fetch fine.
                referrerPolicy="no-referrer"
                // .image carries no sizing in the landscape subtree — the
                // target's carousel sets it on the element it injects.
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  e.currentTarget.src = TAB_FALLBACK[item.tab];
                }}
              />
            </a>
          ))}
        </div>
      </div>

      {/* On the target these two are children of the Carousel, so their
          absolute offsets resolve against .carouselContainer's left edge, not
          the section's. This wrapper restores that containing block. */}
      <div
        style={{
          position: "absolute",
          // Must match .carouselContainer's own offsets: measured against the
          // live section, .carouselContentContainer sits at 35.187rem from the
          // section top, i.e. the carousel's 18.875rem plus its own 16.3125rem.
          top: "18.875rem",
          left: "calc(50% - 51.0625rem - 3.75rem)",
          width: "152.5rem",
          pointerEvents: "none",
        }}
      >
      {/* Detail line. Offsets and type are measured off the live section:
          the "// 公告 <date>" row at 26.46rem from the section top (7.585rem
          inside this wrapper) at 1.5rem/4.41rem, and the title at 29.37rem.
          `.carouselContentContainer` is NOT this panel — on the target it is
          the Carousel's item track (measured 30.94rem tall, one card). */}
      {active && (
        <div
          style={{
            position: "absolute",
            top: "7.585rem",
            left: "1.5rem",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "1.5rem",
              lineHeight: 1,
              fontFamily: "SansMedium, sans-serif",
              color: "#808080",
            }}
          >
            <span>{`// ${t(TAB_LABELS[active.tab])}`}</span>
            <span className={styles.time} style={{ marginLeft: "0" }}>
              {formatDate(active.displayTime)}
            </span>
          </div>
          <div
            className={styles.title}
            style={{
              marginTop: "1.41rem",
              fontSize: "2.25rem",
              lineHeight: 1,
              color: "#000",
            }}
          >
            {active.title}
          </div>
        </div>
      )}

      {/* 更多情报. `.detailButton` carries only position (top 51rem / left
          18.75rem), which against this wrapper resolves to the live section's
          69.874rem / 56.91rem — so no inline offsets are needed. The dark slab
          with the yellow marker is the site's shared Button. */}
      <a
        className={styles.detailButton}
        href="https://endfield.hypergryph.com/news"
        target="_blank"
        rel="noreferrer"
        style={{ pointerEvents: "auto" }}
      >
        <Button>{t("notice.detail")}</Button>
      </a>

        <Pagination
          style={{ pointerEvents: "auto" }}
          className={styles.carouselPagination}
          index={index}
          count={count}
          onPrev={() => setIndex((v) => Math.max(0, v - 1))}
          onNext={() => setIndex((v) => Math.min(count - 1, v + 1))}
        />
      </div>
    </>
  );
}
