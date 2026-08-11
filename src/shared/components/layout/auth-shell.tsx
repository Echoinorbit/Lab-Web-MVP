import Link from "next/link";
import type { ReactNode } from "react";

import { images } from "@/shared/lib/images";

import styles from "./auth-shell.module.css";

export function AuthShell({
  eyebrow,
  title,
  description,
  visualTitle,
  visualDescription,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  visualTitle: string;
  visualDescription: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main id="main-content" className={styles.shell}>
      <div className={styles.backdrop} aria-hidden="true">
        <img className={styles.backdropImage} src={images.loginBackdrop} alt="" />
        <span className={styles.backdropMask} />
      </div>
      <Link href="/" className={styles.brand}>
        <img className={styles.brandMark} src={images.brandMark} alt="" />
        <span>实验室协作</span>
      </Link>
      <section className={styles.intro} aria-label="产品概览">
        <p className={styles.introEyebrow}>// SECURE RESEARCH WORKSPACE</p>
        <h1 className={styles.introTitle}>{visualTitle}</h1>
        <p className={styles.introText}>{visualDescription}</p>
      </section>
      <section className={styles.formPanel} aria-label={title}>
        <p className={styles.eyebrow}>// {eyebrow}</p>
        <h2 className={styles.formTitle}>{title}</h2>
        <p className={styles.formDescription}>{description}</p>
        {children}
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </section>
    </main>
  );
}
