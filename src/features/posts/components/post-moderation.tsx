"use client";

import { Pencil, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, buttonStyles } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/dialog";
import { useToast } from "@/shared/components/ui/toast";

import { deletePostResult } from "../actions/delete-post";

export function PostModeration({
  postId,
  canDelete,
  editHref,
}: {
  postId: string;
  canDelete: boolean;
  editHref?: Route;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await deletePostResult({ postId });
        if (!result.ok) {
          toast({ title: "帖子删除失败", description: result.message, variant: "error" });
          return;
        }
        setDeleteOpen(false);
        toast({ title: "帖子已删除", variant: "success" });
        router.push("/posts");
      } catch {
        toast({
          title: "帖子删除失败",
          description: "删除请求失败，请稍后重试。",
          variant: "error",
        });
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-y border-border/80 py-4">
        <span className="mr-auto text-sm text-muted-foreground">帖子管理</span>
        {editHref ? (
          <Link href={editHref} className={buttonStyles({ variant: "secondary", size: "small" })}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            编辑
          </Link>
        ) : null}
        {canDelete ? (
          <Button type="button" variant="destructive" size="small" disabled={isPending} onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            删除
          </Button>
        ) : null}
      </div>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除这篇帖子？"
        description="帖子会从列表与详情中隐藏，相关审计记录仍会保留。"
        confirmLabel="删除帖子"
        destructive
        pending={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
