"use client";

import { Archive, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/dialog";
import { useToast } from "@/shared/components/ui/toast";

import { archiveProjectResult } from "../actions/archive-project";
import { unarchiveProjectResult } from "../actions/unarchive-project";
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
  const router = useRouter();
  const { toast } = useToast();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() => (archivedAt ? getProjectUnarchiveRemainingMs(archivedAt) : 0));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!archivedAt) return undefined;
    const interval = window.setInterval(() => setRemainingMs(getProjectUnarchiveRemainingMs(archivedAt)), 1000);
    return () => window.clearInterval(interval);
  }, [archivedAt]);

  function updateArchiveState(next: "archive" | "unarchive") {
    startTransition(async () => {
      try {
        const result = next === "archive"
          ? await archiveProjectResult(projectId)
          : await unarchiveProjectResult(projectId);
        if (!result.ok) {
          toast({
            title: next === "archive" ? "归档失败" : "启用失败",
            description: result.message,
            variant: "error",
          });
          return;
        }
        setArchiveOpen(false);
        toast({ title: next === "archive" ? "项目已归档" : "项目已重新启用", variant: "success" });
        router.refresh();
      } catch {
        toast({
          title: next === "archive" ? "归档失败" : "启用失败",
          description: "操作请求失败，请稍后重试。",
          variant: "error",
        });
      }
    });
  }

  if (status === "ARCHIVED" && archivedAt) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="small"
          disabled={remainingMs > 0 || isPending}
          onClick={() => updateArchiveState("unarchive")}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {isPending ? "正在启用…" : "启用项目"}
        </Button>
        <ProjectArchiveCountdown archivedAt={archivedAt} />
      </div>
    );
  }

  if (status !== "PLANNING" && status !== "IN_PROGRESS") return null;

  return (
    <>
      <Button type="button" variant="secondary" size="small" onClick={() => setArchiveOpen(true)} disabled={isPending}>
        <Archive className="h-4 w-4" aria-hidden="true" />
        归档项目
      </Button>
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="归档这个项目？"
        description="项目将变为只读；归档后 7 天内不能重新启用。"
        confirmLabel="归档项目"
        destructive
        pending={isPending}
        onConfirm={() => updateArchiveState("archive")}
      />
    </>
  );
}
