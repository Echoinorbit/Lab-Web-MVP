"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { includeActiveAdminsInNotificationRecipients } from "@/features/notifications/lib/recipients";
import { loadActorSnapshot } from "@/shared/lib/actor-snapshot";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { commentInputSchema } from "@/shared/lib/validators/posts";

import { buildReplyParentWhere } from "../lib/comment-replies";

export async function createComment(input: unknown) {
  const user = await requireActiveUser();
  const data = commentInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.COMMENT_CREATE,
    entityType: "Comment",
    entityId: data.postId,
  });

  const post = await prisma.post.findFirst({
    where: { id: data.postId, deletedAt: null },
    select: { id: true, title: true, authorId: true },
  });
  if (!post) throw new Error("Post not found.");

  if (data.parentId) {
    const parent = await prisma.comment.findFirst({
      where: buildReplyParentWhere(data.postId, data.parentId),
      select: { id: true },
    });
    if (!parent) throw new Error("Parent comment not found.");
  }

  const comment = await prisma.$transaction(async (tx) => {
    const actorSnapshot = await loadActorSnapshot(tx, user.id);
    if (!actorSnapshot) throw new Error("Active user not found.");
    const created = await tx.comment.create({
      data: {
        postId: data.postId,
        parentId: data.parentId,
        content: data.content,
        authorId: user.id,
        authorSnapshot: actorSnapshot,
      },
    });

    const recipientIds = await includeActiveAdminsInNotificationRecipients(tx, {
      recipientIds: post.authorId ? [post.authorId] : [],
      actorId: user.id,
    });
    if (recipientIds.length > 0) {
      await tx.notification.createMany({
        data: recipientIds.map((recipientId) => ({
          userId: recipientId,
          senderId: user.id,
          senderSnapshot: actorSnapshot,
          type: "POST_COMMENT",
          title: "帖子收到新评论",
          content: post.title,
          relatedType: "POST",
          relatedId: post.id,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        actorSnapshot,
        action: "CREATE",
        entityType: "Comment",
        entityId: created.id,
        details: { postId: post.id },
      },
    });

    return created;
  });

  revalidatePath(`/posts/${data.postId}`);
  return { id: comment.id };
}

export type CommentFormState = { ok: boolean; message: string | null };

export async function createCommentFormAction(
  _prevState: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  try {
    await createComment({
      postId: formData.get("postId"),
      content: formData.get("content"),
      parentId: formData.get("parentId") || undefined,
    });
    return { ok: true, message: null };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "评论失败" };
  }
}
