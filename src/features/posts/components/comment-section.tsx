"use client";

import { Trash2, MessageCircle } from "lucide-react";
import { useActionState, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";

import { createCommentFormAction, type CommentFormState } from "../actions/create-comment";
import { deleteCommentFormAction } from "../actions/delete-comment";

export type CommentRow = {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  children?: CommentRow[];
};

const initialState: CommentFormState = { ok: false, message: null };

function CommentItem({
  comment,
  viewerId,
  canModerate,
  canDeleteOwn,
}: {
  comment: CommentRow;
  viewerId: string;
  canModerate: boolean;
  canDeleteOwn: boolean;
}) {
  const canDelete = canModerate || (canDeleteOwn && comment.authorId === viewerId);

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {comment.authorName} · {comment.createdAt}
        </span>
        {canDelete ? (
          <form action={deleteCommentFormAction}>
            <input type="hidden" name="commentId" value={comment.id} />
            <Button type="submit" variant="ghost" className="h-8 px-2">
              <Trash2 className="h-4 w-4" />
              删除
            </Button>
          </form>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
      {comment.children?.length ? (
        <div className="space-y-2 pl-4">
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              comment={child}
              viewerId={viewerId}
              canModerate={canModerate}
              canDeleteOwn={canDeleteOwn}
            />
          ))}
        </div>
      ) : null}
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
  const [content, setContent] = useState("");
  const [state, formAction, isPending] = useActionState(createCommentFormAction, initialState);
  const message = state.message;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageCircle className="h-4 w-4" />
          评论
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length > 0 ? (
          <div className="space-y-3">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                viewerId={viewerId}
                canModerate={canModerate}
                canDeleteOwn={canDeleteOwn}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">暂无评论</div>
        )}
        {canComment ? (
          <form action={formAction} className="grid gap-2">
            <input type="hidden" name="postId" value={postId} />
            <Textarea
              name="content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="写评论"
              required
            />
            {message ? <p className="text-sm text-destructive">{message}</p> : null}
            <Button type="submit" className="w-fit" disabled={isPending || !content.trim()}>
              {isPending ? "提交中" : "提交评论"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
