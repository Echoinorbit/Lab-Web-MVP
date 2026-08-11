"use client";

import { useState } from "react";
import { t, tItems } from "@/content";
import { cn } from "@/lib/utils";
import { Button } from "@/components/Button/Button";
import { SectionTitle } from "@/components/SectionTitle/SectionTitle";
import { CodePrinter } from "@/components/GameplaySection/CodePrinter";
import {
  GameplayAlbum,
  type AlbumItem,
} from "@/components/GameplaySection/GameplayAlbum";
import {
  AicGlyph,
  DecoBlocks,
  EndfieldWordmark,
} from "@/components/GameplaySection/SectionDeco";
import { useInView } from "@/components/GameplaySection/useInView";
import styles from "./AicSection.module.css";

/** One diagram per capability, in the order the dictionary lists them. */
const DIAGRAMS = [
  "/images/01.aae95e75.png",
  "/images/02.e58f9497.png",
  "/images/03.722342c9.png",
  "/images/04.924992fa.png",
  "/images/05.bc9f3f37.png",
] as const;

/** Strings the `.codePrinter` terminal readout cycles through. */
const READOUT = [
  "AIC CORE HANDSHAKE OK",
  "CONVEYOR GRID 12 NODES ACTIVE",
  "POWER RELAY LOAD 64%",
  "PROTOCOL PRINT QUEUE 03 JOBS",
] as const;

const TITLE_EN = "AIC";
const AK_MARK = "ARKNIGHTS: ENDFIELD";
const DETAIL_HREF = "https://endfield.hypergryph.com/";

/**
 * 08-AIC — the five integrated-industry capabilities.
 *
 * Structurally the twin of 05-Gameplay: the same album in its `aic` variant
 * (mirrored, grey blade, stills instead of clips) plus the same right-hand
 * text column. Click-driven; the decor stack and item icon are `opacity: 0` in
 * the extract and are revealed here on scroll.
 */
export function AicSection() {
  const items = tItems("aic.items");
  const [index, setIndex] = useState(0);
  const [decoRef, decoInView] = useInView<HTMLDivElement>();
  const [iconRef, iconInView] = useInView<HTMLDivElement>();

  const albumItems: AlbumItem[] = items.map((item, i) => ({
    title: item.title,
    description: item.description,
    image: DIAGRAMS[i % DIAGRAMS.length],
  }));

  return (
    <section id="aic" data-section="aic" className={styles.sectionContainer}>
      <SectionTitle
        className={cn(styles.pageTitle, styles.aicTitle)}
        titleEn={TITLE_EN}
        titleCn={t("section.aic")}
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
        <AicGlyph className={styles.icon} />
      </div>

      <AicGlyph className={styles.h5Icon} />

      <div className={styles.H5DecoLine}>
        <div className={styles.line}>
          <span className={styles.ak}>{AK_MARK}</span>
          <EndfieldWordmark className={styles.endfield} />
          <img className={styles.deco} src="/images/deco.dbe18bea.svg" alt="" />
        </div>
      </div>

      <GameplayAlbum
        variant="aic"
        titleEn={TITLE_EN}
        items={albumItems}
        index={index}
        onSelect={setIndex}
      />

      <div className={styles.detailButton}>
        <Button
          onClick={() => window.open(DETAIL_HREF, "_blank", "noopener,noreferrer")}
        >
          {t("aic.detail")}
        </Button>
      </div>
    </section>
  );
}
