import { AicSection } from "@/components/AicSection";
import { CalendarSection } from "@/components/CalendarSection/CalendarSection";
import { Footer } from "@/components/Footer/Footer";
import { GameplaySection } from "@/components/GameplaySection";
import { Header } from "@/components/Header/Header";
import { HomeSection } from "@/components/HomeSection/HomeSection";
import { InformationSection } from "@/components/InformationSection/InformationSection";
import { LoreSection } from "@/components/LoreSection/LoreSection";
import { NoticeSection } from "@/components/NoticeSection/NoticeSection";
import { OperatorSection } from "@/components/OperatorSection";
import styles from "@/components/SectionViewer/SectionViewer.module.css";

export default function EndfieldPreviewPage() {
  return (
    <div className={styles.sectionViewer}>
      <div className={styles.header}>
        <Header />
      </div>
      <div className={styles.contentContainer}>
        <HomeSection />
        <OperatorSection />
        <LoreSection />
        <InformationSection />
        <CalendarSection />
        <GameplaySection />
        <AicSection />
        <NoticeSection />
        <Footer />
      </div>
    </div>
  );
}
