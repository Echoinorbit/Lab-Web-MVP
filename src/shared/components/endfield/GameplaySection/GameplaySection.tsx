"use client";

import { useState } from "react";
import { t, tItems } from "@/content";
import { videoUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/SectionTitle/SectionTitle";
import { CodePrinter } from "./CodePrinter";
import { GameplayAlbum, type AlbumItem } from "./GameplayAlbum";
import {
  DecoBlocks,
  EndfieldWordmark,
  GameplayGlyph,
} from "./SectionDeco";
import { useInView } from "./useInView";
import styles from "./GameplaySection.module.css";

/** One clip per pillar, streamed from the CDN exactly as the original does. */
const CLIPS = [
  "static/media/video/01.1e0eb1.mp4",
  "static/media/video/02.9ab299.mp4",
  "static/media/video/03.422a72.mp4",
  "static/media/video/04.7beddb.mp4",
] as const;

/** Strings the `.codePrinter` terminal readout cycles through. */
const READOUT = [
  "TALOS-II SURVEY LINK ESTABLISHED",
  "SQUAD UPLINK 04/04 SYNCED",
  "AIC BLUEPRINT CACHE 78% LOADED",
  "ENDFIELD INDUSTRIES HQ ONLINE",
] as const;

const TITLE_EN = "GAMEPLAY";
const AK_MARK = "ARKNIGHTS: ENDFIELD";

/**
 * 05-Gameplay — the four gameplay pillars.
 *
 * Click-driven: the pagination puck (or a carousel cell) selects a pillar and
 * the album cross-fades to that pillar's clip and copy. The wordmark strip,
 * left decor stack and item icon are the section's own furniture; the decor
 * stack and the icon are `opacity: 0` in the extract and are revealed here on
 * scroll, which is what the production JS does.
 */
export function GameplaySection() {
  const items = tItems("gameplay.items");
  const [index, setIndex] = useState(0);
  const [decoRef, decoInView] = useInView<HTMLDivElement>();
  const [iconRef, iconInView] = useInView<HTMLDivElement>();

  const albumItems: AlbumItem[] = items.map((item, i) => ({
    title: item.title,
    description: item.description,
    video: videoUrl(CLIPS[i % CLIPS.length]),
  }));

  return (
    <section
      id="gameplay"
      data-section="gameplay"
      className={styles.sectionContainer}
    >
      <div className={styles.endfieldPre}>
        <div className={styles.icon}>
          <EndfieldWordmark className={styles.ef} />
        </div>
      </div>

      <SectionTitle
        className={styles.pageTitle}
        titleEn={TITLE_EN}
        titleCn={t("section.gameplay")}
      />

      <div
        ref={decoRef}
        className={cn(styles.decoLeft, decoInView && styles.active)}
      >
        <img className={styles.title} src="/images/deco.dbe18bea.svg" alt="" />
        <DecoBlocks className={styles.blocks} />
        <CodePrinter className={styles.codePrinter} lines={READOUT} />
      </div>

      <div
        ref={iconRef}
        className={cn(styles.itemIcon, iconInView && styles.inView)}
      >
        <GameplayGlyph className={styles.icon} />
      </div>

      <GameplayGlyph className={styles.h5Icon} />

      <div className={styles.H5DecoLine}>
        <div className={styles.line}>
          <span className={styles.ak}>{AK_MARK}</span>
          <EndfieldWordmark className={styles.endfield} />
          <img className={styles.deco} src="/images/deco.dbe18bea.svg" alt="" />
        </div>
      </div>

      <GameplayAlbum
        variant="gameplay"
        titleEn={TITLE_EN}
        items={albumItems}
        index={index}
        onSelect={setIndex}
      />
    </section>
  );
}
