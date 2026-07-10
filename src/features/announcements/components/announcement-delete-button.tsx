"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

import { deleteAnnouncementFormAction } from "../actions/delete";

export function AnnouncementDeleteButton({ announcementId }: { announcementId: string }) {
  return (
    <form action={deleteAnnouncementFormAction} className="flex items-center gap-3">
      <input type="hidden" name="id" value={announcementId} />
      <Button type="submit" variant="ghost" size="small" className="text-destructive hover:text-destructive">
        <Trash2 className="h-4 w-4" />
        删除
      </Button>
    </form>
  );
}
