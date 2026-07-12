"use server";

import { revalidatePath } from "next/cache";

import { getActionErrorMessage } from "@/shared/lib/action-result";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { includeActiveAdminsInNotificationRecipients } from "@/features/notifications/lib/recipients";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { getUserPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";
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

  let comment: { id: string };
  try {
    comment = await prisma.$transaction(async (tx) => {
      const access = await getLockedActiveActor(tx, user.id);
      const permissions = await getUserPermissionsForClient(tx, user.id, access?.now);
      if (!access || !permissions.has(PERMISSIONS.COMMENT_CREATE)) {
        throw new PermissionDeniedError(PERMISSIONS.COMMENT_CREATE);
      }
      const post = await tx.post.findFirst({
        where: { id: data.postId, deletedAt: null },
        select: { id: true, title: true, authorId: true },
      });
      if (!post) throw new Error("帖子不存在或已删除。");

      if (data.parentId) {
        const parent = await tx.comment.findFirst({
          where: buildReplyParentWhere(data.postId, data.parentId),
          select: { id: true },
        });
        if (!parent) throw new Error("回复的评论不存在或已删除。");
      }

      const created = await tx.comment.create({
      data: {
        postId: data.postId,
        parentId: data.parentId,
        content: data.content,
        authorId: user.id,
        authorSnapshot: access.actorSnapshot,
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
          senderSnapshot: access.actorSnapshot,
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
        actorSnapshot: access.actorSnapshot,
        action: "CREATE",
        entityType: "Comment",
        entityId: created.id,
        details: { postId: post.id },
      },
    });

      return created;
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: user.id,
        permission: error.permission,
        entityType: "Comment",
        entityId: data.postId,
      });
    }
    throw error;
  }

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
    return {
      ok: false,
      message: getActionErrorMessage(error, {
        fallbackMessage: "评论失败，请稍后重试。",
        knownMessages: ["帖子不存在或已删除。", "回复的评论不存在或已删除。"],
      }),
    };
  }
}
