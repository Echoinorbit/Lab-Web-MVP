"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, buttonStyles } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/dialog";
import { useToast } from "@/shared/components/ui/toast";

import { deleteProjectNodeResult } from "../actions/delete-node";

export function ProjectNodeActions({ projectId, nodeId, canDelete }: { projectId: string; nodeId: string; canDelete: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await deleteProjectNodeResult({ nodeId });
        if (!result.ok) {
          toast({ title: "节点删除失败", description: result.message, variant: "error" });
          return;
        }
        setDeleteOpen(false);
        toast({ title: "项目节点已删除", description: "项目状态已按剩余节点重新计算。", variant: "success" });
        router.refresh();
      } catch {
        toast({
          title: "节点删除失败",
          description: "删除请求失败，请稍后重试。",
          variant: "error",
        });
      }
    });
  }

  return (
    <>
      <div className="nodrag flex flex-wrap items-center gap-2">
        <Link
          href={`/projects/${projectId}/nodes/${nodeId}/edit` as Route}
          className={buttonStyles({ variant: "secondary", size: "small" })}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          编辑
        </Link>
        {canDelete ? (
          <Button type="button" variant="destructive" size="small" disabled={isPending} onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            删除
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除这个项目节点？"
        description="节点会被软删除，项目的规划中/进行中状态将由剩余有效节点重新派生。"
        confirmLabel="删除节点"
        destructive
        pending={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
