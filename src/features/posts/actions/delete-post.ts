"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auditPermissionDenied } from "@/shared/lib/audit";
import { getUserPermissions, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { deletePostInputSchema } from "@/shared/lib/validators/posts";

import { resolvePostDeleteAccess } from "../lib/author-ops";

export async function deletePost(input: unknown) {
  const user = await requireActiveUser();
  const data = deletePostInputSchema.parse(input);

  const post = await prisma.post.findFirst({
    where: { id: data.postId, deletedAt: null },
    select: { id: true, authorId: true },
  });
  if (!post) throw new Error("Post not found.");

  const permissions = await getUserPermissions(user.id);
  const access = resolvePostDeleteAccess({ userId: user.id, authorId: post.authorId, permissions });
  if (!access.allowed) {
    await auditPermissionDenied({
      userId: user.id,
      permission: access.permission,
      entityType: "Post",
      entityId: data.postId,
    });
    throw new PermissionDeniedError(access.permission);
  }

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: data.postId },
      data: { deletedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE",
        entityType: "Post",
        entityId: data.postId,
        details: { scope: access.scope },
      },
    });
  });

  revalidatePath("/posts");
}

export async function deletePostFormAction(formData: FormData): Promise<void> {
  await deletePost({ postId: formData.get("postId") });
  // The current post page is now soft-deleted; send the user back to the list.
  redirect("/posts");
}
