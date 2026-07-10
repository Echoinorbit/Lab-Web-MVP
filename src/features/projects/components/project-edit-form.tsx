"use client";

import { useActionState, useState } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { StatusNotice } from "@/shared/components/ui/status-notice";

import { updateProjectFormAction, type UpdateProjectState } from "../actions/update-project";

const initialState: UpdateProjectState = { ok: false, message: null };

export function ProjectEditForm({ projectId, name, description }: { projectId: string; name: string; description?: string }) {
  const [content, setContent] = useState(description ?? "");
  const [state, formAction, isPending] = useActionState(updateProjectFormAction, initialState);
  return (
    <Card>
      <CardHeader><CardTitle>编辑项目信息</CardTitle></CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3" aria-busy={isPending}>
          <input type="hidden" name="projectId" value={projectId} />
          <Label htmlFor="edit-project-name">项目名</Label>
          <Input id="edit-project-name" name="name" defaultValue={name} required />
          <Label>简介</Label>
          <MarkdownEditor name="description" value={content} onChange={setContent} placeholder="项目目标、范围与里程碑" />
          {state.message ? <StatusNotice variant={state.ok ? "success" : "error"}>{state.message}</StatusNotice> : null}
          <Button type="submit" className="w-fit" disabled={isPending}>{isPending ? "正在保存…" : "保存修改"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
