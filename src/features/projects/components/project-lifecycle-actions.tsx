"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/dialog";
import { useToast } from "@/shared/components/ui/toast";

import {
  hardDeleteProjectResult,
  restoreProjectResult,
  softDeleteAdvisedProjectResult,
} from "../actions/project-lifecycle";

type DestructiveAction = "soft" | "hard";

export function ProjectLifecycleActions({
  projectId,
  canSoftDelete,
  canRestore,
  canHardDelete,
}: {
  projectId: string;
  canSoftDelete: boolean;
  canRestore: boolean;
  canHardDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmation, setConfirmation] = useState<DestructiveAction | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: "restore" | DestructiveAction) {
    startTransition(async () => {
      try {
        const result = action === "restore"
          ? await restoreProjectResult(projectId)
          : action === "soft"
            ? await softDeleteAdvisedProjectResult(projectId)
            : await hardDeleteProjectResult(projectId);
        if (!result.ok) {
          toast({ title: "项目操作失败", description: result.message, variant: "error" });
          return;
        }
        setConfirmation(null);
        toast({
          title: action === "restore" ? "项目已恢复" : action === "soft" ? "项目已软删除" : "项目已永久删除",
          variant: "success",
        });
        if (action !== "restore") router.push("/projects");
        router.refresh();
      } catch {
        toast({
          title: "项目操作失败",
          description: "操作请求失败，请稍后重试。",
          variant: "error",
        });
      }
    });
  }

  const hardDelete = confirmation === "hard";

  return (
    <div className="flex flex-wrap gap-2">
      {canSoftDelete ? (
        <Button type="button" variant="secondary" size="small" onClick={() => setConfirmation("soft")} disabled={isPending}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />软删除项目
        </Button>
      ) : null}
      {canRestore ? (
        <Button type="button" variant="secondary" size="small" onClick={() => run("restore")} disabled={isPending}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />{isPending ? "正在恢复…" : "恢复项目"}
        </Button>
      ) : null}
      {canHardDelete ? (
        <Button type="button" variant="destructive" size="small" onClick={() => setConfirmation("hard")} disabled={isPending}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />永久删除
        </Button>
      ) : null}
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => { if (!open) setConfirmation(null); }}
        title={hardDelete ? "永久删除这个项目？" : "软删除这个项目？"}
        description={hardDelete
          ? "项目及其节点将被永久移除，操作不可恢复。"
          : "项目会从普通成员视图隐藏，管理员仍可在“已软删除”筛选中恢复。"}
        confirmLabel={hardDelete ? "永久删除" : "软删除"}
        destructive
        pending={isPending}
        onConfirm={() => run(hardDelete ? "hard" : "soft")}
      />
    </div>
  );
}
