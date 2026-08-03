"use client";

import { MessageCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useTransition } from "react";

import { Button } from "@/shared/components/ui/button";
import { ConfirmDialog } from "@/shared/components/ui/dialog";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { SectionHeader } from "@/shared/components/ui/page-header";
import { StatusNotice } from "@/shared/components/ui/status-notice";
import { Textarea } from "@/shared/components/ui/textarea";
import { useToast } from "@/shared/components/ui/toast";
import { cn } from "@/shared/lib/utils";

import { createCommentFormAction, type CommentFormState } from "../actions/create-comment";
import { deleteCommentResult } from "../actions/delete-comment";
import type { CommentRow } from "../types";

export type { CommentRow };

const initialState: CommentFormState = { ok: false, message: null };

function CommentItem({
  postId,
  comment,
  viewerId,
  canComment,
  canModerate,
  canDeleteOwn,
  allowReply,
  depth = 0,
  replyToName,
}: {
  postId: string;
  comment: CommentRow;
  viewerId: string;
  canComment: boolean;
  canModerate: boolean;
  canDeleteOwn: boolean;
  allowReply: boolean;
  depth?: number;
  replyToName?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isDeleted = comment.isDeleted === true;
  const canDelete = !isDeleted && (canModerate || (canDeleteOwn && comment.authorId === viewerId));
  const canReply = !isDeleted && canComment && allowReply;
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyState, replyAction, isReplyPending] = useActionState(createCommentFormAction, initialState);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeletePending, startDeleteTransition] = useTransition();
  const isFlattenedReply = depth >= 2 && Boolean(replyToName) && !isDeleted;
  const nextReplyToName = isDeleted ? "已删除评论" : comment.authorName;

  useEffect(() => {
    if (!replyState.ok) return;
    setReplyContent("");
    setIsReplying(false);
    router.refresh();
  }, [replyState, router]);

  function handleDelete() {
    startDeleteTransition(async () => {
      try {
        const result = await deleteCommentResult({ commentId: comment.id });
        if (!result.ok) {
          toast({ title: "评论删除失败", description: result.message, variant: "error" });
          return;
        }
        setDeleteOpen(false);
        toast({ title: "评论已删除", variant: "success" });
        router.refresh();
      } catch {
        toast({
          title: "评论删除失败",
          description: "删除请求失败，请稍后重试。",
          variant: "error",
        });
      }
    });
  }

  return (
    <div
      data-comment-row
      className={cn(
        "space-y-3 border-t border-border/75 py-5",
        depth > 0 && "border-l border-t-0 py-4 pl-4 sm:pl-5",
        isDeleted && "border-dashed text-muted-foreground",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {isDeleted ? `该评论已删除 · ${comment.createdAt}` : `${comment.authorName} · ${comment.createdAt}`}
        </span>
        {canDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="small"
            className="text-destructive hover:text-destructive"
            disabled={isDeletePending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            删除
          </Button>
        ) : null}
      </div>
      {isDeleted ? (
        <p className="text-sm text-muted-foreground">该评论已被删除</p>
      ) : (
        <p data-comment-content className="whitespace-pre-wrap text-[15px] leading-6">
          {isFlattenedReply ? <span className="mr-1 font-medium text-primary">回复 @{replyToName}</span> : null}
          {comment.content}
        </p>
      )}
      {canReply ? (
        <div className="space-y-2">
          <Button type="button" variant="ghost" size="small" onClick={() => setIsReplying((value) => !value)}>
            回复
          </Button>
          {isReplying ? (
            <form data-comment-reply-form action={replyAction} className="grid gap-3 rounded-xl bg-muted/55 p-4" aria-busy={isReplyPending}>
              <input type="hidden" name="postId" value={postId} />
              <input type="hidden" name="parentId" value={comment.id} />
              <Textarea
                name="content"
                value={replyContent}
                onChange={(event) => setReplyContent(event.target.value)}
                placeholder={`回复 ${comment.authorName}`}
                className="min-h-24 bg-card"
                required
              />
              {replyState.message ? <StatusNotice variant={replyState.ok ? "success" : "error"}>{replyState.message}</StatusNotice> : null}
              <div className="flex gap-2">
                <Button type="submit" size="small" disabled={isReplyPending || !replyContent.trim()}>
                  {isReplyPending ? "正在提交…" : "提交回复"}
                </Button>
                <Button type="button" variant="secondary" size="small" onClick={() => setIsReplying(false)}>
                  取消
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
      {comment.children?.length ? (
        <div className={cn("space-y-1", depth === 0 ? "pl-3 sm:pl-5" : "pl-0")}>
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              postId={postId}
              comment={child}
              viewerId={viewerId}
              canComment={canComment}
              canModerate={canModerate}
              canDeleteOwn={canDeleteOwn}
              allowReply={true}
              depth={depth + 1}
              replyToName={nextReplyToName}
            />
          ))}
        </div>
      ) : null}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除这条评论？"
        description="评论内容会被隐藏，但回复结构与审计记录仍会保留。"
        confirmLabel="删除评论"
        destructive
        pending={isDeletePending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export function CommentSection({
  postId,
  comments,
  viewerId,
  canComment,
  canModerate,
  canDeleteOwn,
}: {
  postId: string;
  comments: readonly CommentRow[];
  viewerId: string;
  canComment: boolean;
  canModerate: boolean;
  canDeleteOwn: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [state, formAction, isPending] = useActionState(createCommentFormAction, initialState);
  const message = state.message;

  useEffect(() => {
    if (!state.ok) return;
    setContent("");
    router.refresh();
  }, [router, state]);

  return (
    <section className="space-y-6 border-t border-border/80 pt-8 sm:pt-10">
      <SectionHeader
        title={(
          <span className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            评论
          </span>
        )}
        description={`${comments.length} 条讨论`}
      />
      <div>
        {comments.length > 0 ? (
          <div>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                postId={postId}
                comment={comment}
                viewerId={viewerId}
                canComment={canComment}
                canModerate={canModerate}
                canDeleteOwn={canDeleteOwn}
                allowReply={true}
              />
            ))}
          </div>
        ) : (
          <EmptyState className="min-h-36 py-8" title="暂无评论" description="围绕这篇帖子展开第一条讨论。" />
        )}
      </div>
        {canComment ? (
          <form action={formAction} className="grid gap-3 rounded-3xl border border-white/60 bg-card p-5 shadow-[var(--shadow-surface)] dark:border-border/80 sm:p-6" aria-busy={isPending}>
            <input type="hidden" name="postId" value={postId} />
            <label htmlFor="new-comment" className="text-sm font-medium">发表评论</label>
            <Textarea
              id="new-comment"
              name="content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="写下你的观点或问题"
              required
            />
            {message ? <StatusNotice variant={state.ok ? "success" : "error"}>{message}</StatusNotice> : null}
            <Button type="submit" className="w-fit" disabled={isPending || !content.trim()}>
              {isPending ? "正在提交…" : "提交评论"}
            </Button>
          </form>
        ) : null}
    </section>
  );
}
