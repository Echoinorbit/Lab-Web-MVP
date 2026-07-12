"use server";

import { revalidatePath } from "next/cache";

import { toActionResult } from "@/shared/lib/action-result";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { getUserPermissionsForClient, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";
import { deleteCommentInputSchema } from "@/shared/lib/validators/posts";

import { resolveCommentDeleteAccess } from "../lib/author-ops";

export async function deleteComment(input: unknown) {
  const user = await requireActiveUser();
  const data = deleteCommentInputSchema.parse(input);

  let postId: string;
  try {
    postId = await prisma.$transaction(async (tx) => {
      const currentActor = await getLockedActiveActor(tx, user.id);
      await tx.$queryRaw`SELECT "id" FROM "Comment" WHERE "id" = ${data.commentId} FOR UPDATE`;
      const comment = await tx.comment.findFirst({
        where: { id: data.commentId, deletedAt: null },
        select: { postId: true, authorId: true },
      });
      if (!comment) throw new Error("评论不存在或已删除。");

      const permissions = await getUserPermissionsForClient(tx, user.id, currentActor?.now);
      const access = resolveCommentDeleteAccess({ userId: user.id, authorId: comment.authorId, permissions });
      if (!currentActor || !access.allowed) throw new PermissionDeniedError(access.permission);

      await tx.comment.update({
        where: { id: data.commentId },
        data: { deletedAt: currentActor.now },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorSnapshot: currentActor.actorSnapshot,
          action: "DELETE",
          entityType: "Comment",
          entityId: data.commentId,
          details: { postId: comment.postId, scope: access.scope },
        },
      });
      return comment.postId;
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: user.id,
        permission: error.permission,
        entityType: "Comment",
        entityId: data.commentId,
      });
    }
    throw error;
  }

  revalidatePath(`/posts/${postId}`);
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
