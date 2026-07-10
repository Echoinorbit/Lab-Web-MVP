"use client";

import { Archive, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/button";

import { archiveProjectFormAction } from "../actions/archive-project";
import { unarchiveProjectFormAction } from "../actions/unarchive-project";
import { getProjectUnarchiveRemainingMs } from "../lib/archive";
import { ProjectArchiveCountdown } from "./project-archive-countdown";

export function ArchiveProjectButton({
  projectId,
  status,
  archivedAt,
}: {
  projectId: string;
  status: string;
  archivedAt?: string | null;
}) {
  const [remainingMs, setRemainingMs] = useState(() => (archivedAt ? getProjectUnarchiveRemainingMs(archivedAt) : 0));

  useEffect(() => {
    if (!archivedAt) return undefined;
    const interval = window.setInterval(() => {
      setRemainingMs(getProjectUnarchiveRemainingMs(archivedAt));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [archivedAt]);

  if (status === "ARCHIVED" && archivedAt) {
    return (
      <form action={unarchiveProjectFormAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="projectId" value={projectId} />
        <Button type="submit" variant="secondary" size="small" disabled={remainingMs > 0}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          启用项目
        </Button>
        <ProjectArchiveCountdown archivedAt={archivedAt} />
      </form>
    );
  }

  if (status !== "IN_PROGRESS") return null;

  return (
    <form action={archiveProjectFormAction} className="flex items-center gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <Button type="submit" variant="secondary" size="small">
        <Archive className="h-4 w-4" aria-hidden="true" />
        归档项目
      </Button>
    </form>
  );
}
