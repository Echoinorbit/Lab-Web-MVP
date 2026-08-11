"use client";

import { useState } from "react";
import { t } from "@/content";
import { scrollToSection, useScrollSpy } from "@/hooks/useScrollSpy";
import { cn } from "@/lib/utils";
import type { SectionId } from "@/types/site";
import styles from "./Header.module.css";
import {
  AicIcon,
  CalendarIcon,
  CloseIcon,
  ExternalLinkIcon,
  GameplayIcon,
  HomeIcon,
  InformationIcon,
  LanguageIcon,
  LoreIcon,
  MenuIcon,
  NoticeIcon,
  OperatorIcon,
  SoundOffIcon,
  SoundOnIcon,
  TriangleIcon,
  UserIcon,
} from "./HeaderIcons";

/**
 * Nav item placement, taken verbatim from the bundle's own transform helper:
 *   eZ = i => `translateY(${((202 + 80 * i + 4) / 16).toFixed(3)}rem)`
 * i.e. a 12.875rem offset and a 5rem stride — not the 4.5rem `.navItem`
 * height, which is the hit area rather than the pitch.
 */
const NAV_TOP_OFFSET_REM = 12.875;
const NAV_ITEM_HEIGHT_REM = 5;

const NAV_ITEMS = [
  { id: "home", labelKey: "nav.home", Icon: HomeIcon },
  { id: "operator", labelKey: "nav.operator", Icon: OperatorIcon },
  { id: "lore", labelKey: "nav.lore", Icon: LoreIcon },
  { id: "information", labelKey: "nav.information", Icon: InformationIcon },
  { id: "calendar", labelKey: "nav.calendar", Icon: CalendarIcon },
  { id: "gameplay", labelKey: "nav.gameplay", Icon: GameplayIcon },
  { id: "aic", labelKey: "nav.aic", Icon: AicIcon },
  { id: "notice", labelKey: "nav.notice", Icon: NoticeIcon },
] as const satisfies readonly {
  id: SectionId;
  labelKey: string;
  Icon: typeof HomeIcon;
}[];

const SECTION_IDS = NAV_ITEMS.map((item) => item.id);

/** `data-key` values the CSS sizes individually. */
const ICON_KEY: Record<SectionId, string> = {
  home: "home",
  operator: "operator",
  lore: "lore",
  information: "information",
  calendar: "calendar",
  gameplay: "gameplay",
  aic: "aicGameplay",
  notice: "notice",
};

interface HeaderProps {
  /** Overrides scroll-spy — useful when rendering the rail in isolation. */
  activeSection?: SectionId;
}

/**
 * The site-wide navigation.
 *
 * Landscape renders a full-height 7.5rem left rail; portrait renders a 9.625rem
 * top bar with a slide-out menu. Both live in this component and are switched
 * purely by the orientation queries in Header.module.css.
 */
export function Header({ activeSection }: HeaderProps) {
  const spied = useScrollSpy(SECTION_IDS);
  const active = activeSection ?? spied;
  const activeIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => item.id === active),
  );

  const [muted, setMuted] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (id: SectionId) => {
    scrollToSection(id);
    setMenuOpen(false);
  };

  const logo = (

    <img className={styles.logo} src="/images/logo.fc8e2a3c.png" alt="明日方舟：终末地" />
  );

  const navList = NAV_ITEMS.map((item, index) => {
    const { id, labelKey, Icon } = item;
    return (
      <button
        key={id}
        type="button"
        className={cn(styles.navItem, id === active && styles.active)}
        style={{
          transform: `translate3d(0, ${NAV_TOP_OFFSET_REM + index * NAV_ITEM_HEIGHT_REM}rem, 0)`,
        }}
        onClick={() => go(id)}
        aria-label={t(labelKey)}
        aria-current={id === active ? "true" : undefined}
      >
        <Icon className={styles.icon} data-key={ICON_KEY[id]} />
        <span className={styles.textWrapper}>{t(labelKey)}</span>
      </button>
    );
  });

  const utilityButtons = (
    <div className={cn(styles.buttonFrameContainer, styles.ele3)}>
      <button type="button" className={styles.button} aria-label={t("header.login")}>
        <UserIcon className={styles.icon} />
      </button>
      <span className={styles.divider} style={{ top: "3rem" }} />
      <button
        type="button"
        className={styles.button}
        style={{ transform: "translate3d(0, 3rem, 0)" }}
        aria-label={t("common.selectLanguage")}
      >
        <LanguageIcon className={styles.icon} />
      </button>
      <span className={styles.divider} style={{ top: "6rem" }} />
      <button
        type="button"
        className={styles.button}
        style={{ transform: "translate3d(0, 6rem, 0)" }}
        onClick={() => setMuted((value) => !value)}
        aria-label={muted ? t("header.mute.on") : t("header.mute.off")}
        aria-pressed={muted}
      >
        {muted ? (
          <SoundOffIcon className={styles.icon} />
        ) : (
          <SoundOnIcon className={styles.icon} />
        )}
      </button>
    </div>
  );

  return (
    <>
      <div className={cn(styles.pcHeaderContainer, styles.showPreserveButton)}>
        <div className={styles.innerContainer}>
          {logo}

          <div
            className={styles.overlay}
            style={{
              transform: `translate3d(0, ${NAV_TOP_OFFSET_REM - 0.25 + activeIndex * NAV_ITEM_HEIGHT_REM}rem, 0)`,
            }}
          />

          <nav className={styles.navList} aria-label={t("nav.home")}>
            {navList}
          </nav>

          <div className={cn(styles.buttonFrameBg, styles.ele3)} />
          {utilityButtons}

          <a
            className={styles.buttonPreserveBg}
            href="https://endfield.hypergryph.com/"
            aria-label={t("header.goToGame")}
          >
            <TriangleIcon className={styles.tri} />
            <span className={styles.divider} />
            <span className={styles.text}>{t("header.goToGame")}</span>
          </a>

          <button
            type="button"
            className={styles.buttonShareBg}
            aria-label={t("home.skland")}
          >
            <ExternalLinkIcon className={styles.shareIcon} />
          </button>

          <span className={styles.creator}>{t("header.creator")}</span>
        </div>
      </div>

      <div className={styles.h5HeaderContainer}>
        {logo}
        <button
          type="button"
          className={styles.menuIcon}
          onClick={() => setMenuOpen((value) => !value)}
          aria-label={t("nav.home")}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>

        {menuOpen && (
          <div className={styles.h5Menu}>
            <div className={styles.menuButtons}>
              {NAV_ITEMS.map(({ id, labelKey, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={cn(styles.menuItem, id === active && styles.active)}
                  onClick={() => go(id)}
                >
                  <Icon className={styles.icon} data-key={ICON_KEY[id]} />
                  <span className={styles.text}>{t(labelKey)}</span>
                </button>
              ))}
            </div>
            <div className={styles.menuBottomButtons}>
              <button type="button" className={styles.iconButton} aria-label={t("header.login")}>
                <UserIcon className={styles.icon} />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={t("common.selectLanguage")}
              >
                <LanguageIcon className={styles.icon} />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setMuted((value) => !value)}
                aria-label={muted ? t("header.mute.on") : t("header.mute.off")}
              >
                {muted ? (
                  <SoundOffIcon className={styles.icon} />
                ) : (
                  <SoundOnIcon className={styles.icon} />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
