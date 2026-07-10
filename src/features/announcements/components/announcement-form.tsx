"use client";

import { useActionState, useState } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { StatusNotice } from "@/shared/components/ui/status-notice";

import { createAnnouncementFormAction, type AnnouncementFormState } from "../actions/create";
import { TargetSelector } from "./target-selector";

const initialState: AnnouncementFormState = { ok: false, message: null };

export type AnnouncementProjectOption = {
  id: string;
  name: string;
};

export function AnnouncementForm({ projects = [] }: { projects?: readonly AnnouncementProjectOption[] }) {
  const [content, setContent] = useState("");
  const [state, formAction, isPending] = useActionState(createAnnouncementFormAction, initialState);
  const message = state.message;

  return (
    <form action={formAction} className="grid gap-6" aria-busy={isPending}>
      <div className="space-y-2">
        <Label htmlFor="title">标题</Label>
        <Input id="title" name="title" placeholder="用一句话说明公告内容" required />
      </div>
      <div className="space-y-2">
        <Label>内容</Label>
        <MarkdownEditor name="content" value={content} onChange={setContent} placeholder="使用 Markdown 编写公告正文" />
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">发布属性</legend>
        <div className="flex flex-wrap gap-5">
          <label className="flex min-h-11 items-center gap-2.5 text-sm">
            <input name="isUrgent" type="checkbox" className="h-4 w-4 rounded border-input accent-primary" />
            标记为紧急
          </label>
          <label className="flex min-h-11 items-center gap-2.5 text-sm">
            <input name="isPinned" type="checkbox" className="h-4 w-4 rounded border-input accent-primary" />
            置顶显示
          </label>
        </div>
      </fieldset>
      <TargetSelector projects={projects} />
      {message ? <StatusNotice variant={state.ok ? "success" : "error"}>{message}</StatusNotice> : null}
      <div className="border-t border-border/80 pt-5">
        <Button type="submit" disabled={isPending}>
          {isPending ? "正在发布…" : "发布公告"}
        </Button>
      </div>
    </form>
  );
}
