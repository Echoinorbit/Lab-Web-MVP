"use client";

import type { Route } from "next";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

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
    <div className="flex flex-wrap items-center gap-3">
      {editHref ? (
        <Link
          href={editHref}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Pencil className="h-4 w-4" />
          编辑帖子
        </Link>
      ) : null}
      {canDelete ? (
        <form action={deletePostFormAction}>
          <input type="hidden" name="postId" value={postId} />
          <Button type="submit" variant="destructive">
            <Trash2 className="h-4 w-4" />
            删除帖子
          </Button>
        </form>
      ) : null}
    </div>
  );
}
