"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auditPermissionDenied } from "@/shared/lib/audit";
import { getUserPermissions, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { splitCommaList } from "@/shared/lib/utils";
import { updatePostInputSchema } from "@/shared/lib/validators/posts";

import { resolvePostUpdateAccess } from "../lib/author-ops";
import { mergePostTagLabels } from "../lib/post-tags";

export async function updatePost(input: unknown) {
  const user = await requireActiveUser();
  const data = updatePostInputSchema.parse(input);

  const post = await prisma.post.findFirst({
    where: { id: data.postId, deletedAt: null },
    select: { id: true, authorId: true },
  });
  if (!post) throw new Error("Post not found.");

  const permissions = await getUserPermissions(user.id);
  const access = resolvePostUpdateAccess({ userId: user.id, authorId: post.authorId, permissions });
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
    for (const tag of data.tags) {
      await tx.userPostTag.upsert({
        where: { userId_label: { userId: user.id, label: tag } },
        create: { userId: user.id, label: tag },
        update: {},
      });
    }

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
        action: "UPDATE",
        entityType: "Post",
        entityId: data.postId,
        details: { category: data.category, scope: access.scope },
      },
    });
  });

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
  const selectedTags = formData.getAll("selectedTags").map(String);
  const newTags = splitCommaList(String(formData.get("newTags") ?? ""));
  const tags = mergePostTagLabels(selectedTags, newTags);

  try {
    await updatePost({
      postId,
      title: formData.get("title"),
      category: formData.get("category"),
      content: formData.get("content"),
      tags,
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "保存失败" };
  }
  redirect(`/posts/${postId}`);
}
