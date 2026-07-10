"use client";

import { useActionState, useState } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { StatusNotice } from "@/shared/components/ui/status-notice";

import { createProjectFormAction, type ProjectFormState } from "../actions/create-project";
import { AdvisorStudentTree, type ProjectAdvisorOption } from "./advisor-student-tree";

const initialState: ProjectFormState = { ok: false, message: null };

export function ProjectForm({
  advisors,
  lockedAdvisorId,
}: {
  advisors: readonly ProjectAdvisorOption[];
  lockedAdvisorId?: string;
}) {
  const [description, setDescription] = useState("");
  const [advisorId, setAdvisorId] = useState(lockedAdvisorId ?? "");
  const [memberUserIds, setMemberUserIds] = useState<string[]>([]);
  const [leadUserId, setLeadUserId] = useState("");
  const [state, formAction, isPending] = useActionState(createProjectFormAction, initialState);
  const message = state.message;

  return (
    <form action={formAction} className="grid gap-6" aria-busy={isPending}>
      <div className="space-y-2">
        <Label htmlFor="project-name">项目名</Label>
        <Input id="project-name" name="name" placeholder="例如：多模态遥感目标检测" required />
      </div>
      <div className="space-y-2">
        <Label>描述</Label>
        <MarkdownEditor name="description" value={description} onChange={setDescription} placeholder="项目目标、范围与里程碑" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-advisor">负责导师</Label>
        {lockedAdvisorId ? <input type="hidden" name="advisorId" value={lockedAdvisorId} /> : null}
        <Select
          id="project-advisor"
          name={lockedAdvisorId ? undefined : "advisorId"}
          className="w-full"
          value={advisorId}
          disabled={Boolean(lockedAdvisorId)}
          required
          onChange={(event) => {
            setAdvisorId(event.target.value);
            setMemberUserIds([]);
            setLeadUserId("");
          }}
        >
          <option value="">选择负责导师</option>
          {advisors.map((advisor) => (
            <option key={advisor.id} value={advisor.id}>
              {advisor.displayName} ({advisor.username})
            </option>
          ))}
        </Select>
      </div>
      <AdvisorStudentTree
        advisor={advisors.find((advisor) => advisor.id === advisorId)}
        selectedIds={memberUserIds}
        onSelectedIdsChange={setMemberUserIds}
        leadUserId={leadUserId}
        onLeadUserIdChange={setLeadUserId}
      />
      {!leadUserId ? <StatusNotice>勾选学生后，请指定其中一人为项目组长。</StatusNotice> : null}
      {message ? <StatusNotice variant={state.ok ? "success" : "error"}>{message}</StatusNotice> : null}
      <div className="border-t border-border/80 pt-5">
        <Button type="submit" disabled={isPending || !advisorId || !leadUserId}>
          {isPending ? "正在创建…" : "创建项目"}
        </Button>
      </div>
    </form>
  );
}
