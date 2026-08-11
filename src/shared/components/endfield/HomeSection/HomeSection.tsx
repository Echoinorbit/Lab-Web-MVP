"use client";

import { useEffect, useState } from "react";
import { t } from "@/content";
import { cn } from "@/lib/utils";
import styles from "./HomeSection.module.css";

/**
 * Store buttons in the download panel.
 *
 * `.platforms` is a flex row of `.line` columns, and the panel is 12.5rem tall
 * minus 3.6875rem of title padding — room for exactly two 3.625rem rows. Hence
 * three columns rather than two, with TapTap bottom-aligned in the third to
 * match the live layout (App Store / 安卓下载 on row one; PS5 / PC下载 / TapTap
 * on row two).
 */
const PLATFORMS = [
  {
    bottom: false,
    items: [
      { key: "appStore", label: "App Store", sub: t("home.downloadMobile") },
      { key: "ps5", label: "PS5", sub: "" },
    ],
  },
  {
    bottom: false,
    items: [
      { key: "android", label: t("home.downloadAndroid"), sub: "" },
      { key: "pc", label: t("home.downloadPc"), sub: "" },
    ],
  },
  {
    bottom: true,
    items: [{ key: "taptap", label: "TapTap", sub: "Windows" }],
  },
] as const;

/**
 * 01-Home — the full-viewport key-art hero.
 *
 * Everything marked `data-animation-element` starts at `opacity: 0` in the
 * extracted CSS; the target fades them in on load, which `revealed` reproduces
 * with a short stagger driven by the CSS `.d0`–`.d4` delay classes.
 */
export function HomeSection() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <section id="home" data-section="home" className={styles.sectionContainer}>
      <div className={styles.bgContainer}>
        <div className={styles.bg}>
          <div className={styles.horizontalMask}>
            <div className={styles.verticalMask}>
              <div
                className={styles.inner}
                style={{ backgroundImage: "url(/images/kv_v1d4.d0e55f7f.jpg)" }}
              />
            </div>
          </div>
        </div>
        <div className={styles.mask} />

        <div className={cn(styles.titleFrame, styles.cn)}>
          <div className={styles.text}>
            <span className={styles.innerText}>{t("home.title.v1d4")}</span>
          </div>

          <div className={styles.subtitle1}>
            <span className={styles.titleBg} />
            <span className={styles.innerText}>{t("home.title1.v1d4")}</span>
          </div>

          <div className={styles.suTitleContainer}>
            <div className={styles.subtitle2}>
              <span className={styles.innerText}>{t("home.title2.v1d4")}</span>
            </div>
            <div className={styles.subtitle3}>
              <span className={styles.innerText}>{t("home.title3.v1d4")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={cn(styles.pcContainer, revealed && styles.revealed)}>
        {/* The bundle keys this as `home.v1d4Cele` — the 26 相伴庆典 badge.
            core_cn.png is a different asset: the red 核心章节版本 bar, which
            the CSS already applies to .subtitle1 .titleBg. */}
        <img
          className={styles.rtButtonGroup}
          src="/images/zh-cn.106ce05d.png"
          alt=""
          data-animation-element
        />

        <div className={styles.age} data-animation-element />

        <button
          type="button"
          className={cn(styles.cloudGameButton, styles.d0)}
          aria-label={t("home.cloudGame")}
          data-animation-element
        >
          <span className={styles.cloudGameIcon} />
        </button>

        <div className={styles.rbContainer}>
          <div className={cn(styles.downloadWrapper, styles.d1)} data-animation-element>
            <div className={styles.downloadContainer}>
              <div className={styles.downloadTitle}>{t("home.download")}</div>

              {/* .qrcode and .platforms are both scoped under .contentContainer
                  in the extract — it is the flex row that sits them side by
                  side under the title. */}
              <div className={styles.contentContainer}>
                <div className={styles.qrcode} aria-label={t("home.qrcode")} />

                <div className={styles.platforms}>
                  {PLATFORMS.map((column, i) => (
                    <div
                      className={styles.line}
                      key={i}
                      style={column.bottom ? { justifyContent: "flex-end" } : undefined}
                    >
                      {column.items.map((item) => (
                        <a
                          key={item.key}
                          className={cn(styles.item, styles[item.key])}
                          href="https://endfield.hypergryph.com/"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className={styles.text}>{item.label}</span>
                          {item.sub && (
                            <span className={styles.innerText}>{item.sub}</span>
                          )}
                        </a>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={cn(styles.extraContainer, styles.d2)} data-animation-element>
            <a
              className={styles.button}
              href="https://user.hypergryph.com/"
              target="_blank"
              rel="noreferrer"
            >
              <span className={styles.iconCharge} />
              <span className={styles.text}>{t("home.charge")}</span>
            </a>
            <a
              className={styles.button}
              href="https://www.skland.com/"
              target="_blank"
              rel="noreferrer"
            >
              <span className={styles.iconSkland} />
              <span className={styles.text}>{t("home.skland")}</span>
            </a>
          </div>
        </div>
      </div>

      <div className={styles.h5Container}>
        <div className={styles.scrollTip} />
      </div>
    </section>
  );
}
