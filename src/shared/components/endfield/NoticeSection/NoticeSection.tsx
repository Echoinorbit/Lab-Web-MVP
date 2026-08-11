import { SectionTitle } from "@/components/SectionTitle/SectionTitle";
import { t } from "@/content";
import { fetchBulletin } from "@/lib/bulletin";
import styles from "./NoticeSection.module.css";
import { NoticeCarousel } from "./NoticeCarousel";

/**
 * 06-Notice — the news board, fed by the same public bulletin API the target
 * calls. Server Component: the feed is fetched on the server and revalidated
 * every five minutes, with the carousel hydrated as a client child.
 */
export async function NoticeSection() {
  const items = await fetchBulletin();

  return (
    <section
      id="notice"
      data-section="notice"
      className={styles.sectionContainer}
    >
      <div className={styles.leftDeco}>
        <div className={styles.wrapper}>
          <div className={styles.bottomPart} />
        </div>
        <div className={styles.topPart} />
        <div className={styles.textWrapper}>
          <span className={styles.latest}>{t("common.latest")}</span>
          <span className={styles.divider} />
        </div>
      </div>

      <SectionTitle
        className={styles.pageTitle}
        titleEn="NOTICE"
        titleCn={t("section.notice")}
      />

      {/* The 更多情报 button lives inside the carousel wrapper — its offsets
          resolve against .carouselContainer, not the section. */}
      <NoticeCarousel items={items} />
    </section>
  );
}
