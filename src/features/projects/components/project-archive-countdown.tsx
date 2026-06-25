"use client";

import { useEffect, useState } from "react";

import {
  formatProjectArchiveRemaining,
  getProjectUnarchiveRemainingMs,
} from "../lib/archive";

export function ProjectArchiveCountdown({ archivedAt }: { archivedAt: string }) {
  const [remainingMs, setRemainingMs] = useState(() => getProjectUnarchiveRemainingMs(archivedAt));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemainingMs(getProjectUnarchiveRemainingMs(archivedAt));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [archivedAt]);

  if (remainingMs <= 0) return <span className="text-xs text-muted-foreground">可重新启用</span>;
  return <span className="text-xs text-muted-foreground">可启用倒计时：{formatProjectArchiveRemaining(remainingMs)}</span>;
}
