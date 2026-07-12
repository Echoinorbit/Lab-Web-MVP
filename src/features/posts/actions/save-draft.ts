"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { getUserPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";
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

  let draft: { id: string };
  try {
    draft = await prisma.$transaction(async (tx) => {
      const access = await getLockedActiveActor(tx, user.id);
      const permissions = await getUserPermissionsForClient(tx, user.id, access?.now);
      if (!access || !permissions.has(PERMISSIONS.POST_CREATE)) {
        throw new PermissionDeniedError(PERMISSIONS.POST_CREATE);
      }
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
        if (!existing) throw new Error("草稿不存在或已删除。");

        return tx.post.update({
          where: { id: data.postId },
          data: {
            title: data.title,
            content: data.content,
            category: data.category,
            tags: data.tags,
            authorSnapshot: access.actorSnapshot,
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
          authorSnapshot: access.actorSnapshot,
        },
        select: { id: true },
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
  revalidatePath(`/posts/${draft.id}`);
  return { id: draft.id };
}
