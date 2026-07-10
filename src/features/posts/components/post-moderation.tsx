"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { Button, buttonStyles } from "@/shared/components/ui/button";

import { deletePostFormAction } from "../actions/delete-post";

export function PostModeration({
  postId,
  canDelete,
  editHref,
}: {
  postId: string;
  canDelete: boolean;
  editHref?: Route;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-y border-border/80 py-4">
      <span className="mr-auto text-sm text-muted-foreground">帖子管理</span>
      {editHref ? (
        <Link href={editHref} className={buttonStyles({ variant: "secondary", size: "small" })}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          编辑
        </Link>
      ) : null}
      {canDelete ? (
        <form action={deletePostFormAction}>
          <input type="hidden" name="postId" value={postId} />
          <Button type="submit" variant="destructive" size="small">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            删除
          </Button>
        </form>
      ) : null}
    </div>
  );
}
