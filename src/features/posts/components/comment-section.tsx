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
  postId,
  comment,
  viewerId,
  canComment,
  canModerate,
  canDeleteOwn,
  allowReply,
}: {
  postId: string;
  comment: CommentRow;
  viewerId: string;
  canComment: boolean;
  canModerate: boolean;
  canDeleteOwn: boolean;
  allowReply: boolean;
}) {
  const canDelete = canModerate || (canDeleteOwn && comment.authorId === viewerId);
  const canReply = canComment && allowReply;
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyState, replyAction, isReplyPending] = useActionState(createCommentFormAction, initialState);

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
      {canReply ? (
        <div className="space-y-2">
          <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => setIsReplying((value) => !value)}>
            回复
          </Button>
          {isReplying ? (
            <form action={replyAction} className="grid gap-2">
              <input type="hidden" name="postId" value={postId} />
              <input type="hidden" name="parentId" value={comment.id} />
              <Textarea
                name="content"
                value={replyContent}
                onChange={(event) => setReplyContent(event.target.value)}
                placeholder={`回复 ${comment.authorName}`}
                required
              />
              {replyState.message ? <p className="text-sm text-destructive">{replyState.message}</p> : null}
              <div className="flex gap-2">
                <Button type="submit" className="w-fit" disabled={isReplyPending || !replyContent.trim()}>
                  {isReplyPending ? "提交中" : "提交回复"}
                </Button>
                <Button type="button" variant="secondary" className="w-fit" onClick={() => setIsReplying(false)}>
                  取消
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
      {comment.children?.length ? (
        <div className="space-y-2 pl-4">
          {comment.children.map((child) => (
            <CommentItem
              key={child.id}
              postId={postId}
              comment={child}
              viewerId={viewerId}
              canComment={canComment}
              canModerate={canModerate}
              canDeleteOwn={canDeleteOwn}
              allowReply={false}
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
