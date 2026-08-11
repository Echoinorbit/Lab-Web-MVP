"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** White-on-black variant used on dark backgrounds. */
  light?: boolean;
  /** Greyed out and non-interactive. */
  disabled?: boolean;
}

/**
 * The site's primary CTA button — dark slab with a textured overlay, a yellow
 * marker on the left that morphs into an arrow and slides right on hover.
 */
export function Button({
  children,
  light = false,
  disabled = false,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        styles.button,
        light && styles.light,
        disabled && styles.disabled,
        className,
      )}
      {...rest}
    >
      <span className={styles.text}>{children}</span>
    </button>
  );
}
