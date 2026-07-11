"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/dialog";
import { useToast } from "@/shared/components/ui/toast";

import { deleteAnnouncementResult } from "../actions/delete";

export function AnnouncementDeleteButton({ announcementId, returnToList = false }: { announcementId: string; returnToList?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        const result = await deleteAnnouncementResult({ id: announcementId });
        if (!result.ok) {
          toast({ title: "删除失败", description: result.message, variant: "error" });
          return;
        }
        setOpen(false);
        toast({ title: "公告已删除", variant: "success" });
        if (returnToList) router.push("/announcements");
        router.refresh();
      } catch {
        toast({
          title: "删除失败",
          description: "删除请求失败，请稍后重试。",
          variant: "error",
        });
      }
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="small" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        删除
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="删除这条公告？"
        description="公告将从成员视图中移除。该操作会写入审计日志。"
        confirmLabel="删除公告"
        destructive
        pending={isPending}
        onConfirm={handleDelete}
      />
    </>
  );
}
