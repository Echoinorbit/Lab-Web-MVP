"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { draftInputSchema } from "@/shared/lib/validators/posts";

export async function saveDraft(input: unknown) {
  const user = await requireActiveUser();
  const data = draftInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.POST_CREATE,
    entityType: "Post",
    entityId: data.postId,
  });

  const draft = await prisma.$transaction(async (tx) => {
    if (data.postId) {
      const existing = await tx.post.findFirst({
        where: {
          id: data.postId,
          authorId: user.id,
          status: "DRAFT",
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!existing) throw new Error("Draft not found.");

      return tx.post.update({
        where: { id: data.postId },
        data: {
          title: data.title,
          content: data.content,
          category: data.category,
          tags: data.tags,
        },
        select: { id: true },
      });
    }

    return tx.post.create({
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        tags: data.tags,
        status: "DRAFT",
        authorId: user.id,
      },
      select: { id: true },
    });
  });

  revalidatePath("/posts");
  revalidatePath(`/posts/${draft.id}`);
  return { id: draft.id };
}
