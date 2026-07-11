"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { StatusNotice } from "@/shared/components/ui/status-notice";
import { useToast } from "@/shared/components/ui/toast";

import { updateAnnouncementResult } from "../actions/update";

export function AnnouncementEditForm({
  announcement,
}: {
  announcement: {
    id: string;
    title: string;
    content: string;
    isUrgent: boolean;
    isPinned: boolean;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(announcement.title);
  const [content, setContent] = useState(announcement.content);
  const [isUrgent, setIsUrgent] = useState(announcement.isUrgent);
  const [isPinned, setIsPinned] = useState(announcement.isPinned);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateAnnouncementResult({ id: announcement.id, title, content, isUrgent, isPinned });
        if (!result.ok) {
          setError(result.message);
          toast({ title: "公告保存失败", description: result.message, variant: "error" });
          return;
        }
        toast({ title: "公告已保存", variant: "success" });
        router.push(`/announcements/${announcement.id}`);
        router.refresh();
      } catch {
        const message = "公告保存请求失败，请稍后重试。";
        setError(message);
        toast({ title: "公告保存失败", description: message, variant: "error" });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6" aria-busy={isPending}>
      <div className="space-y-2">
        <Label htmlFor="announcement-edit-title">标题</Label>
        <Input
          id="announcement-edit-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          minLength={2}
          maxLength={160}
          required
          disabled={isPending}
        />
      </div>
      <div className="space-y-2">
        <Label>内容</Label>
        <MarkdownEditor
          name="content"
          value={content}
          onChange={setContent}
          placeholder="使用 Markdown 编写公告正文"
        />
      </div>
      <fieldset className="space-y-3" disabled={isPending}>
        <legend className="text-sm font-medium">发布属性</legend>
        <div className="flex flex-wrap gap-5">
          <label className="flex min-h-11 items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(event) => setIsUrgent(event.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            标记为紧急
          </label>
          <label className="flex min-h-11 items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={isPinned}
              onChange={(event) => setIsPinned(event.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            置顶显示
          </label>
        </div>
      </fieldset>
      {error ? <StatusNotice variant="error">{error}</StatusNotice> : null}
      <div className="flex flex-wrap gap-2 border-t border-border/80 pt-5">
        <Button type="submit" disabled={isPending || title.trim().length < 2 || !content.trim()}>
          {isPending ? "正在保存…" : "保存修改"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={isPending}>取消</Button>
      </div>
    </form>
  );
}
