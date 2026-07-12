"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auditPermissionDenied } from "@/shared/lib/audit";
import { getUserPermissionsForClient, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";
import { splitCommaList } from "@/shared/lib/utils";
import { updatePostInputSchema } from "@/shared/lib/validators/posts";

import { resolvePostUpdateAccess } from "../lib/author-ops";
import { formatPostValidationError } from "../lib/post-validation-copy";

export async function updatePost(input: unknown) {
  const user = await requireActiveUser();
  const data = updatePostInputSchema.parse(input);

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
      const access = resolvePostUpdateAccess({ userId: user.id, authorId: post.authorId, permissions });
      if (!currentActor || !access.allowed) throw new PermissionDeniedError(access.permission);

      await tx.post.update({
        where: { id: data.postId },
        data: {
          title: data.title,
          content: data.content,
          category: data.category,
          tags: data.tags,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorSnapshot: currentActor.actorSnapshot,
          action: "UPDATE",
          entityType: "Post",
          entityId: data.postId,
          details: { category: data.category, scope: access.scope },
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
  revalidatePath(`/posts/${data.postId}`);
  return { id: data.postId };
}

export type UpdatePostFormState = { ok: boolean; message: string | null };

export async function updatePostFormAction(
  _prevState: UpdatePostFormState,
  formData: FormData,
): Promise<UpdatePostFormState> {
  const postId = String(formData.get("postId") ?? "");
  const tags = splitCommaList(String(formData.get("tags") ?? ""));

  try {
    await updatePost({
      postId,
      title: formData.get("title"),
      category: formData.get("category"),
      content: formData.get("content"),
      tags,
    });
  } catch (error) {
    return {
      ok: false,
      message: formatPostValidationError(error, "保存失败，请稍后重试。", ["帖子不存在或已删除。"]),
    };
  }
  redirect(`/posts/${postId}`);
}
