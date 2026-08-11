"use client";

import { useState } from "react";
import { SectionTitle } from "@/components/SectionTitle/SectionTitle";
import { t } from "@/content";
import { cn } from "@/lib/utils";
import styles from "./LoreSection.module.css";

/** Entry order on the live site — it opens on 帝江号 showing "1 / 6". */
const KEYS = [
  "spaceship",
  "factory",
  "pile",
  "anchor",
  "trinity",
  "enemy",
] as const;

const FADE = "opacity .6s cubic-bezier(0.85,0,0.15,1)";

function IconLore({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 84 85" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M78.5 68 62.48.71h-6.62L64.07 68zM42 .71 25.98 68h6.62L40.8.71zM5.5 68 21.52.71h6.62L19.93 68zM0 78.5h84v6H0z"
      />
    </svg>
  );
}

/**
 * 03-Lore — the worldview archive.
 *
 * Click-driven: six entries behind prev/next controls and a dot rail. Verified
 * on the live site — scrolling through the section changes nothing.
 *
 * `.canvasContainer` is left empty on purpose. On the target it is the mount
 * point for a runtime-rendered 3D model viewer; the bundle ships no static
 * artwork for the six subjects, so there is nothing faithful to put there.
 */
export function LoreSection() {
  const [index, setIndex] = useState(0);

  const key = KEYS[index];
  const count = KEYS.length;
  const go = (next: number) => setIndex((next + count) % count);

  return (
    <section id="lore" data-section="lore">
      <div className={styles.sectionDivider}>
        <div className={styles.dividerSubtitle}>ARKNIGHTS: ENDFIELD</div>
        <div className={styles.dividerTitle}>LORE</div>
      </div>

      <div className={styles.container}>
        <div className={styles.decoLine1} />
        <div className={styles.decoLine2} />
        <div className={styles.decoLine3} />
        <div className={styles.decoLine4} />
        <div className={styles.decoLine5} />
        <div className={styles.decoLine6} />

        <div className={styles.safeArea}>
          <div className={styles.ringWrapper}>
            <div className={styles.ring} />
          </div>
        </div>

        <div className={styles.lattice} />
        <div className={styles.colorBlock} />

        <SectionTitle
          className={styles.title}
          titleEn="lore"
          titleCn={t("section.lore")}
          dark
        />

        <div className={styles.canvasContainer} />

        <div className={styles.iconLoreWrapper}>
          <IconLore className={styles.iconLore} />
        </div>

        <div className={styles.safeArea}>
          <div className={styles.infoWrapper}>
            <div className={styles.info}>
              <div key={key} style={{ animation: `ef-fade-in .6s both` }}>
                <div className={styles.activeCodename}>
                  {t(`lore.models.${key}.codename`)}
                </div>
                <div className={styles.gameCode}>ARKNIGHTS: ENDFIELD</div>
              </div>

              <div className={styles.navigation}>
                <div className={styles.navigator}>
                  <div className={styles.activeName}>
                    <div
                      key={key}
                      className={styles.inner}
                      style={{ animation: `ef-fade-in .6s both` }}
                    >
                      <span className={styles.paging}>
                        {index + 1} / {count}
                      </span>
                      <span className={styles.name}>
                        {t(`lore.models.${key}.name`)}
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(styles.navBtn, styles.prev)}
                    onClick={() => go(index - 1)}
                    role="button"
                    tabIndex={0}
                    aria-label="Previous"
                    onKeyDown={(e) => e.key === "Enter" && go(index - 1)}
                  />
                  <div
                    className={cn(styles.navBtn, styles.next)}
                    onClick={() => go(index + 1)}
                    role="button"
                    tabIndex={0}
                    aria-label="Next"
                    onKeyDown={(e) => e.key === "Enter" && go(index + 1)}
                  />
                </div>

                <div className={styles.naviDots}>
                  {KEYS.map((entry, i) => (
                    <div
                      key={entry}
                      className={cn(styles.naviDot, i === index && styles.active)}
                      onClick={() => setIndex(i)}
                      role="button"
                      tabIndex={0}
                      aria-label={t(`lore.models.${entry}.name`)}
                      aria-current={i === index ? "true" : undefined}
                      onKeyDown={(e) => e.key === "Enter" && setIndex(i)}
                    />
                  ))}
                </div>
              </div>

              <p
                key={`intro-${key}`}
                className={styles.activeIntro}
                style={{ animation: `ef-fade-in .3s both`, transition: FADE }}
              >
                {t(`lore.models.${key}.intro`)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
