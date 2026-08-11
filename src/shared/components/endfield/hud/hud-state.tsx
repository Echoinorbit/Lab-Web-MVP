"use client";

import Link from "next/link";
import type { Route } from "next";

import styles from "./hud-state.module.css";

type HudStateProps = {
  code: string;
  label: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  loading?: boolean;
};

export function HudState({ code, label, title, message, actionLabel, actionHref, onAction, loading = false }: HudStateProps) {
  return (
    <section className={styles.state} role={loading ? "status" : undefined} aria-live={loading ? "polite" : undefined}>
      <div className={styles.panel}>
        <p className={styles.label}>// {label}</p>
        <p className={styles.code} aria-hidden="true">{code}<span className="animate-[ef-flashing_1s_steps(1,end)_infinite]">_</span></p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.message}>{message}</p>
        {loading ? <div className={styles.progress} aria-hidden="true" /> : null}
        {actionHref && actionLabel ? <Link href={actionHref as Route} className={styles.action}>{actionLabel}</Link> : null}
        {onAction && actionLabel ? <button type="button" className={styles.action} onClick={onAction}>{actionLabel}</button> : null}
      </div>
    </section>
  );
}
