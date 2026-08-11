import styles from "./dashboard-home.module.css";

export function DashboardHome() {
  return (
    <section data-section="dashboard-home" className={styles.hero} aria-labelledby="dashboard-title">
      <div className={styles.background} aria-hidden="true">
        <div className={styles.artwork}>
          <div className={styles.horizontalMask}>
            <div className={styles.verticalMask}>
              <div className={styles.artworkImage} />
            </div>
          </div>
        </div>
        <div className={styles.backgroundFade} />
      </div>

      <div className={styles.titleFrame}>
        <p className={styles.eyebrow}>
          <span className={styles.eyebrowText}>THE BEST LABTORY</span>
        </p>

        <h1 id="dashboard-title" className={styles.title}>
          <span className={styles.titleText}>景存人杳</span>
        </h1>

        <div className={styles.subtitleGroup}>
          <p className={styles.description}>
            <span className={styles.descriptionText}>目前仅完成了部分功能</span>
          </p>
        </div>
      </div>
    </section>
  );
}
