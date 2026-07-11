"use server";

import { revalidatePath } from "next/cache";

import { toActionResult } from "@/shared/lib/action-result";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { getUserPermissions, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { deleteCommentInputSchema } from "@/shared/lib/validators/posts";

import { resolveCommentDeleteAccess } from "../lib/author-ops";

export async function deleteComment(input: unknown) {
  const user = await requireActiveUser();
  const data = deleteCommentInputSchema.parse(input);

  const comment = await prisma.comment.findFirst({
    where: { id: data.commentId, deletedAt: null },
    select: { postId: true, authorId: true },
  });
  if (!comment) throw new Error("评论不存在或已删除。");

  const permissions = await getUserPermissions(user.id);
  const access = resolveCommentDeleteAccess({ userId: user.id, authorId: comment.authorId, permissions });
  if (!access.allowed) {
    await auditPermissionDenied({
      userId: user.id,
      permission: access.permission,
      entityType: "Comment",
      entityId: data.commentId,
    });
    throw new PermissionDeniedError(access.permission);
  }

  await prisma.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id: data.commentId },
      data: { deletedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE",
        entityType: "Comment",
        entityId: data.commentId,
        details: { postId: comment.postId, scope: access.scope },
      },
    });
  });

  revalidatePath(`/posts/${comment.postId}`);
}

export async function deleteCommentResult(input: unknown) {
  return toActionResult(async () => {
    await deleteComment(input);
    return null;
  }, {
    fallbackMessage: "评论删除失败，请稍后重试。",
    knownMessages: ["评论不存在或已删除。"],
  });
}
