"use client";

import { useEffect, useState } from "react";
import { videoUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { Operator } from "@/types/site";
import styles from "./OperatorSection.module.css";

/** `3d` plays the operator's video loop, `2d` shows the still illustration. */
export type StageMode = "3d" | "2d";

/** One-shot entrance clip, then the looping idle clip. */
type VideoPhase = "enter" | "idle";

/**
 * How long to wait for the CDN before falling back to the still illustration.
 * The clips are ~19 MB each and stream from `web.hycdn.cn`, so a slow or
 * blocked network must never leave the stage empty.
 */
const VIDEO_TIMEOUT_MS = 8000;

interface OperatorStageProps {
  operator: Operator;
  mode: StageMode;
}

/**
 * The right-hand art stage: a `<video>` that plays `enter` once and then loops
 * `idle`, with the 1760x1548 illustration as the 2D view and as the fallback
 * whenever the video cannot be played.
 */
export function OperatorStage({ operator, mode }: OperatorStageProps) {
  const [phase, setPhase] = useState<VideoPhase>("enter");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stagedKey, setStagedKey] = useState(operator.key);

  // A new operator restarts the enter -> idle cycle from scratch. Done during
  // render so the stage never paints one frame of the previous operator's
  // "ready" state against the new operator's video.
  if (stagedKey !== operator.key) {
    setStagedKey(operator.key);
    setPhase("enter");
    setReady(false);
    setFailed(false);
  }

  useEffect(() => {
    if (ready || failed) return;
    const timer = window.setTimeout(() => setFailed(true), VIDEO_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [operator.key, ready, failed]);

  const source = videoUrl(phase === "enter" ? operator.enterVideo : operator.idleVideo);
  const showVideo = mode === "3d" && ready && !failed;
  const showStill = mode === "2d" || failed;
  const showLoading = mode === "3d" && !ready && !failed;

  return (
    <div className={styles.h5illustrationContainer}>
      <div className={styles.illustrationContainer}>
        <div
          className={cn(styles.illustration, showStill && styles.visible)}
          data-key={operator.visualKey ?? operator.key}
        />

        <div className={styles.videoContainer}>
          <div
            className={cn(styles.videoEleContainer, showVideo && styles.visible)}
            data-key={operator.visualKey ?? operator.key}
          >
            <video
              key={`${operator.key}-${phase}`}
              className={styles.video}
              src={source}
              autoPlay
              muted
              playsInline
              preload="none"
              loop={phase === "idle"}
              onCanPlay={() => setReady(true)}
              onEnded={() => setPhase("idle")}
              onError={() => setFailed(true)}
            />
          </div>
        </div>

        <div className={cn(styles.loadingContainer, showLoading && styles.visible)} />
      </div>
    </div>
  );
}
