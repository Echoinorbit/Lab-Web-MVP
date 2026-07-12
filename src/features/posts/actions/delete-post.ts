"use server";

import { revalidatePath } from "next/cache";

import { toActionResult } from "@/shared/lib/action-result";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { getUserPermissionsForClient, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";
import { deletePostInputSchema } from "@/shared/lib/validators/posts";

import { resolvePostDeleteAccess } from "../lib/author-ops";

export async function deletePost(input: unknown) {
  const user = await requireActiveUser();
  const data = deletePostInputSchema.parse(input);

  try {
    await prisma.$transaction(async (tx) => {
      const currentActor = await getLockedActiveActor(tx, user.id);
      await tx.$queryRaw`SELECT "id" FROM "Post" WHERE "id" = ${data.postId} FOR UPDATE`;
      const post = await tx.post.findFirst({
        where: { id: data.postId, deletedAt: null },
        select: { id: true, authorId: true },
      });
      if (!post) throw new Error("帖子不存在或已删除。");

      const permissions = await getUserPermissionsForClient(tx, user.id, currentActor?.now);
      const access = resolvePostDeleteAccess({ userId: user.id, authorId: post.authorId, permissions });
      if (!currentActor || !access.allowed) throw new PermissionDeniedError(access.permission);

      await tx.post.update({
        where: { id: data.postId },
        data: { deletedAt: currentActor.now },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorSnapshot: currentActor.actorSnapshot,
          action: "DELETE",
          entityType: "Post",
          entityId: data.postId,
          details: { scope: access.scope },
        },
      });
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: user.id,
        permission: error.permission,
        entityType: "Post",
        entityId: data.postId,
      });
    }
    throw error;
  }

  revalidatePath("/posts");
}

export async function deletePostResult(input: unknown) {
  return toActionResult(async () => {
    await deletePost(input);
    return null;
  }, {
    fallbackMessage: "帖子删除失败，请稍后重试。",
    knownMessages: ["帖子不存在或已删除。"],
  });
}
