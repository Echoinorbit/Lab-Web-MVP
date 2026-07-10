"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

import { deleteProjectNodeFormAction, type DeleteProjectNodeState } from "../actions/delete-node";

const initialDeleteState: DeleteProjectNodeState = { ok: false, message: null };

export function ProjectNodeActions({ projectId, nodeId }: { projectId: string; nodeId: string }) {
  const [state, formAction, isPending] = useActionState(deleteProjectNodeFormAction, initialDeleteState);

  return (
    <div className="nodrag flex flex-wrap items-center gap-2">
      <Link
        href={`/projects/${projectId}/nodes/${nodeId}/edit`}
        className={cn(
          "inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <Pencil className="h-3.5 w-3.5" />
        编辑
      </Link>
      <form action={formAction}>
        <input type="hidden" name="nodeId" value={nodeId} />
        <Button type="submit" variant="destructive" className="h-8 px-2 text-xs" disabled={isPending}>
          <Trash2 className="h-3.5 w-3.5" />
          {isPending ? "删除中" : "删除"}
        </Button>
      </form>
      {state.message ? <span className="text-xs text-muted-foreground">{state.message}</span> : null}
    </div>
  );
}
