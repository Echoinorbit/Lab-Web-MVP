"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { addProjectMemberFormAction, type ProjectMemberState } from "../actions/add-member";
import { AdvisorStudentTree, type ProjectAdvisorOption } from "./advisor-student-tree";

const initialState: ProjectMemberState = { ok: false, message: null };

export function ProjectMemberForm({
  projectId,
  advisor,
}: {
  projectId: string;
  advisor?: ProjectAdvisorOption;
}) {
  const [state, formAction, isPending] = useActionState(addProjectMemberFormAction, initialState);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const message = state.message;

  useEffect(() => {
    if (state.ok) setSelectedIds([]);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">邀请成员</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="projectId" value={projectId} />
          <AdvisorStudentTree
            advisor={advisor}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
            memberInputName="userIds"
          />
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button type="submit" className="w-fit" disabled={isPending || selectedIds.length === 0}>
            {isPending ? "处理中" : `加入 ${selectedIds.length} 人`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
