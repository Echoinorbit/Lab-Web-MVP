"use client";

import { useActionState, useState } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { StatusNotice } from "@/shared/components/ui/status-notice";

import { updatePostFormAction, type UpdatePostFormState } from "../actions/update-post";

const initialState: UpdatePostFormState = { ok: false, message: null };

const categoryOptions = [
  ["GENERAL", "综合"],
  ["EXPERIENCE", "经验分享"],
  ["TUTORIAL", "教程"],
  ["DISCUSSION", "讨论"],
  ["RESOURCE", "资源分享"],
] as const;

export function PostEditForm({
  postId,
  title,
  category,
  content,
  tags,
}: {
  postId: string;
  title: string;
  category: string;
  content: string;
  tags: readonly string[];
}) {
  const [body, setBody] = useState(content);
  const [state, formAction, isPending] = useActionState(updatePostFormAction, initialState);
  const message = state.message;

  return (
    <form action={formAction} className="grid gap-5" aria-busy={isPending}>
      <input type="hidden" name="postId" value={postId} />
      <div className="space-y-2">
        <Label htmlFor="post-title">标题</Label>
        <Input id="post-title" name="title" defaultValue={title} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="post-category">分类</Label>
        <Select
          id="post-category"
          name="category"
          defaultValue={category}
          className="w-full"
        >
          {categoryOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="post-tags">标签</Label>
        <Input
          id="post-tags"
          name="tags"
          defaultValue={tags.join("，")}
          placeholder="多个标签用逗号分隔（中英文逗号均可）"
        />
      </div>
      <MarkdownEditor name="content" value={body} onChange={setBody} placeholder="Markdown 正文" />
      {message ? <StatusNotice variant={state.ok ? "success" : "error"}>{message}</StatusNotice> : null}
      <div className="border-t border-border/80 pt-5">
        <Button type="submit" disabled={isPending}>
          {isPending ? "正在保存…" : "保存修改"}
        </Button>
      </div>
    </form>
  );
}
