"use client";

import { useActionState, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { MarkdownEditor } from "@/shared/components/markdown-editor";

import { TargetSelector } from "./target-selector";
import { createAnnouncementFormAction, type AnnouncementFormState } from "../actions/create";

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
    <Card>
      <CardHeader>
        <CardTitle>发布公告</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input id="title" name="title" required />
          </div>
          <div className="space-y-2">
            <Label>内容</Label>
            <MarkdownEditor name="content" value={content} onChange={setContent} placeholder="Markdown 内容" />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input name="isUrgent" type="checkbox" />
              紧急
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input name="isPinned" type="checkbox" />
              置顶
            </label>
          </div>
          <TargetSelector projects={projects} />
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <Button type="submit" className="w-fit" disabled={isPending}>
            {isPending ? "发布中" : "发布"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
