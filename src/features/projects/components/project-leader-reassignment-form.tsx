"use client";

import { useActionState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { StatusNotice } from "@/shared/components/ui/status-notice";

import {
  reassignProjectLeaderFormAction,
  type ProjectLeaderReassignmentState,
} from "../actions/reassign-project-leader";
import type { ProjectStudentOption } from "./advisor-student-tree";

const initialState: ProjectLeaderReassignmentState = { ok: false, message: null };

export function ProjectLeaderReassignmentForm({
  projectId,
  candidates,
}: {
  projectId: string;
  candidates: readonly ProjectStudentOption[];
}) {
  const [state, formAction, isPending] = useActionState(reassignProjectLeaderFormAction, initialState);
  const selectId = `project-${projectId}-replacement-leader`;

  return (
    <Card data-project-leader-reassignment>
      <CardHeader><CardTitle>重新分配项目负责人</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3" aria-busy={isPending}>
          <input type="hidden" name="projectId" value={projectId} />
          <Label htmlFor={selectId}>新的项目负责人</Label>
          <Select id={selectId} name="leaderId" defaultValue="" required disabled={isPending || candidates.length === 0}>
            <option value="">选择负责导师的直属在读硕博成员</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.displayName} ({candidate.studentId ?? candidate.username}{candidate.grade ? ` · ${candidate.grade}` : ""})
              </option>
            ))}
          </Select>
          {candidates.length === 0 ? (
            <StatusNotice variant="warning">当前没有符合条件的直属在读硕博成员，请先完善学生培养身份。</StatusNotice>
          ) : null}
          {state.message ? <StatusNotice variant={state.ok ? "success" : "error"}>{state.message}</StatusNotice> : null}
          <Button type="submit" className="w-fit" disabled={isPending || candidates.length === 0}>
            {isPending ? "正在重新分配…" : "确认重新分配"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
