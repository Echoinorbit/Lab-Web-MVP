"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { splitCommaList } from "@/shared/lib/utils";

import { createPostFormAction, type CreatePostFormState } from "../actions/create-post";
import { shouldAutosaveDraft } from "../lib/drafts";
import { joinPostTagLabels } from "../lib/post-tags";

const initialState: CreatePostFormState = { ok: false, message: null, tone: "error" };

export type PostDraftInitial = {
  id?: string;
  title?: string;
  category?: string;
  content?: string;
  tags?: readonly string[];
};

export function PostForm({
  initialDraft,
  quotaNotice,
}: {
  initialDraft?: PostDraftInitial;
  quotaNotice?: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [draftId, setDraftId] = useState(initialDraft?.id ?? "");
  const draftIdRef = useRef(initialDraft?.id ?? "");
  const [content, setContent] = useState(initialDraft?.content ?? "");
  const contentRef = useRef(initialDraft?.content ?? "");
  const skipAutosaveRef = useRef(false);
  const [state, formAction, isPending] = useActionState(createPostFormAction, initialState);
  const message = state.message;

  useEffect(() => {
    if (!state.draftId) return;
    draftIdRef.current = state.draftId;
    setDraftId(state.draftId);
  }, [state.draftId]);

  const buildDraftPayload = useCallback(() => {
    const form = formRef.current;
    if (!form) return null;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "");
    const currentContent = contentRef.current;
    if (!shouldAutosaveDraft({ title, content: currentContent })) return null;

    return {
      postId: draftIdRef.current || undefined,
      title,
      category: String(formData.get("category") ?? "GENERAL"),
      content: currentContent,
      tags: splitCommaList(String(formData.get("tags") ?? "")),
    };
  }, []);

  const rememberDraftId = useCallback((id: string) => {
    draftIdRef.current = id;
    setDraftId(id);
  }, []);

  const autosaveDraft = useCallback(
    (preferBeacon: boolean) => {
      if (skipAutosaveRef.current) return;
      const payload = buildDraftPayload();
      if (!payload) return;
      const body = JSON.stringify(payload);
      if (preferBeacon && navigator.sendBeacon) {
        const sent = navigator.sendBeacon("/api/posts/drafts", new Blob([body], { type: "application/json" }));
        if (sent) return;
      }
      void fetch("/api/posts/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        credentials: "include",
        keepalive: preferBeacon,
      })
        .then(async (response) => {
          if (!response.ok) return;
          const result = (await response.json().catch(() => null)) as { id?: unknown } | null;
          if (typeof result?.id === "string") rememberDraftId(result.id);
        })
        .catch(() => undefined);
    },
    [buildDraftPayload, rememberDraftId],
  );

  useEffect(() => {
    if (!isPending) skipAutosaveRef.current = false;
  }, [isPending]);

  useEffect(() => {
    const handleBeforeUnload = () => autosaveDraft(true);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      autosaveDraft(true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [autosaveDraft]);

  function handleContentChange(nextContent: string) {
    contentRef.current = nextContent;
    setContent(nextContent);
  }

  const messageClassName =
    state.ok || state.tone === "info"
      ? "rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
      : "text-sm text-destructive";

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4"
      onSubmit={() => {
        skipAutosaveRef.current = true;
      }}
    >
      <input type="hidden" name="postId" value={draftId} />
      <div className="space-y-2">
        <Label htmlFor="post-title">标题</Label>
        <Input id="post-title" name="title" defaultValue={initialDraft?.title ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="post-category">分类</Label>
        <select
          id="post-category"
          name="category"
          defaultValue={initialDraft?.category ?? "GENERAL"}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="GENERAL">综合</option>
          <option value="EXPERIENCE">经验分享</option>
          <option value="TUTORIAL">教程</option>
          <option value="DISCUSSION">讨论</option>
          <option value="RESOURCE">资源分享</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="post-tags">标签</Label>
        <Input
          id="post-tags"
          name="tags"
          defaultValue={joinPostTagLabels(initialDraft?.tags ?? [])}
          placeholder="多个标签用逗号分隔（中英文逗号均可）"
        />
      </div>
      <MarkdownEditor name="content" value={content} onChange={handleContentChange} placeholder="Markdown 正文" />
      {quotaNotice ? <p className="text-sm text-muted-foreground">{quotaNotice}</p> : null}
      {message ? <p className={messageClassName}>{message}</p> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="intent" value="publish" disabled={isPending}>
          {isPending ? "处理中" : "发布"}
        </Button>
        <Button type="submit" name="intent" value="save-draft" variant="secondary" disabled={isPending}>
          保存草稿
        </Button>
      </div>
    </form>
  );
}
