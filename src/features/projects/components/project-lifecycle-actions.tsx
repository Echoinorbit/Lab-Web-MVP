"use client";

import { RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/shared/components/ui/button";

import {
  hardDeleteProjectFormAction,
  restoreProjectFormAction,
  softDeleteProjectFormAction,
} from "../actions/project-lifecycle";

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
  return (
    <div className="flex flex-wrap gap-2">
      {canSoftDelete ? (
        <form action={softDeleteProjectFormAction} onSubmit={(event) => {
          if (!window.confirm("软删除后仅管理员可见并可恢复，确认继续？")) event.preventDefault();
        }}>
          <input type="hidden" name="projectId" value={projectId} />
          <Button type="submit" variant="secondary"><Trash2 className="h-4 w-4" />软删除项目</Button>
        </form>
      ) : null}
      {canRestore ? (
        <form action={restoreProjectFormAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <Button type="submit" variant="secondary"><RotateCcw className="h-4 w-4" />恢复项目</Button>
        </form>
      ) : null}
      {canHardDelete ? (
        <form action={hardDeleteProjectFormAction} onSubmit={(event) => {
          if (!window.confirm("永久删除后不可恢复，确认继续？")) event.preventDefault();
        }}>
          <input type="hidden" name="projectId" value={projectId} />
          <Button type="submit" variant="destructive"><Trash2 className="h-4 w-4" />永久删除</Button>
        </form>
      ) : null}
    </div>
  );
}
