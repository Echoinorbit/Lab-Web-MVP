"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/content/media";
import styles from "./MediaModal.module.css";

interface MediaModalProps {
  /** The trailer to play, or `null` when the modal is closed. */
  item: MediaItem | null;
  /** Asked to close — the owner clears `item`. */
  onClose: () => void;
}

/**
 * The full-screen trailer player opened from 04-Information.
 *
 * Controlled: the section owns the open state and this renders nothing while
 * `item` is `null`. Closing is wired to the yellow close button, a backdrop
 * click and Escape; body scroll is locked for the duration and the `<video>`
 * is paused with its `src` cleared on the way out so audio stops immediately
 * rather than lingering on a detached element.
 */
export function MediaModal({ item, onClose }: MediaModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  const open = item !== null;

  // Closing is a plain derivation, so reset during render rather than in an
  // effect — the modal unmounts on the same commit either way.
  if (!open && active) {
    setActive(false);
  }

  // Opening needs a frame's delay so the CSS opacity transition has a starting
  // value to animate from.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Move focus into the dialog so keyboard users land inside it.
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  // Stop playback and detach the stream when the modal goes away.
  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    return () => {
      if (!video) return;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [open]);

  const onBackdropClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
    [onClose],
  );

  if (!item) return null;

  return (
    <div
      className={cn(styles.mediaModal, active && styles.active)}
      onClick={onBackdropClick}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className={styles.modalContainer}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        tabIndex={-1}
      >
        <video
          ref={videoRef}
          className={styles.mediaVideo}
          src={item.src}
          poster={item.poster}
          controls
          autoPlay
          playsInline
        />

        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          <svg
            className={styles.closeIcon}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M5 5 L19 19 M19 5 L5 19"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
