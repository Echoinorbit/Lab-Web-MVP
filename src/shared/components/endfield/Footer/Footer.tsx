"use client";

import { useState } from "react";
import { t } from "@/content";
import { cn } from "@/lib/utils";
import styles from "./Footer.module.css";

/** Locales the production build ships translations for. */
const LANGUAGES = [
  { code: "zh-cn", label: "简体中文" },
  { code: "zh-tw", label: "繁體中文" },
  { code: "en-us", label: "English" },
  { code: "ja-jp", label: "日本語" },
  { code: "ko-kr", label: "한국어" },
  { code: "th-th", label: "ไทย" },
  { code: "vi-vn", label: "Tiếng Việt" },
] as const;

const LINKS = [
  { key: "header.charge", href: "https://user.hypergryph.com/" },
  { key: "home.skland", href: "https://www.skland.com/" },
  { key: "header.creator", href: "https://endfield.hypergryph.com/" },
] as const;

function GlobeIcon() {
  return (
    <svg
      className={styles.globe}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      className={styles.arrow}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

/**
 * Site footer — a dark band carrying the language switcher and the outbound
 * link row.
 *
 * Publisher registration details are deliberately omitted: the real footer
 * renders licence and ICP numbers that belong to Hypergryph, and inventing
 * plausible-looking ones would be worse than leaving them out.
 */
export function Footer() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<string>("zh-cn");

  const current =
    LANGUAGES.find((item) => item.code === language) ?? LANGUAGES[0];

  return (
    <footer className={styles.footer}>
      <div className={styles.topContainer}>
        <div className={styles.label}>{t("common.selectLanguage")}</div>

        <div
          className={cn(styles.languageItem, open && styles.active)}
          onClick={() => setOpen((value) => !value)}
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen((value) => !value);
            }
          }}
        >
          <GlobeIcon />
          <span className={styles.text}>{current.label}</span>
          <ArrowIcon />

          <div className={styles.dropDown}>
            <div className={styles.dropDownScroll}>
              <div className={styles.contentContainer}>
                {LANGUAGES.map((item) => (
                  <div
                    key={item.code}
                    className={styles.dropDownItem}
                    onClick={(event) => {
                      event.stopPropagation();
                      setLanguage(item.code);
                      setOpen(false);
                    }}
                    role="button"
                    tabIndex={open ? 0 : -1}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.links}>
          {LINKS.map(({ key, href }) => (
            <a
              key={key}
              className={styles.link}
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              <span>{t(key)}</span>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
