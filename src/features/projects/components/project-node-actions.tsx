"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { Button, buttonStyles } from "@/shared/components/ui/button";

import { deleteProjectNodeFormAction, type DeleteProjectNodeState } from "../actions/delete-node";

const initialDeleteState: DeleteProjectNodeState = { ok: false, message: null };

export function ProjectNodeActions({ projectId, nodeId }: { projectId: string; nodeId: string }) {
  const [state, formAction, isPending] = useActionState(deleteProjectNodeFormAction, initialDeleteState);

  return (
    <div className="nodrag flex flex-wrap items-center gap-2">
      <Link
        href={`/projects/${projectId}/nodes/${nodeId}/edit`}
        className={buttonStyles({ variant: "secondary", size: "small" })}
      >
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
        编辑
      </Link>
      <form action={formAction}>
        <input type="hidden" name="nodeId" value={nodeId} />
        <Button type="submit" variant="destructive" size="small" disabled={isPending}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          {isPending ? "正在删除…" : "删除"}
        </Button>
      </form>
      {state.message ? <span className="text-xs text-muted-foreground">{state.message}</span> : null}
    </div>
  );
}
