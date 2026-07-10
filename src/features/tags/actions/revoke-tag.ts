"use server";

import { revalidatePath } from "next/cache";

import { assertAnyPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { revokeTagInputSchema } from "@/shared/lib/validators/tags";

import { assertManuallyManageableTagName } from "../lib/project-tag-guard";

export async function revokeTag(input: unknown) {
  const actor = await requireActiveUser();
  const data = revokeTagInputSchema.parse(input);

  await assertAnyPermissionWithAudit({
    userId: actor.id,
    permissions: [PERMISSIONS.ADMIN_TAG_MANAGE, PERMISSIONS.TAG_REVOKE],
    entityType: "UserTag",
    entityId: data.userTagId,
  });

  const userTag = await prisma.userTag.findUniqueOrThrow({
    where: { id: data.userTagId },
    select: {
      id: true,
      userId: true,
      projectId: true,
      tag: { select: { name: true } },
    },
  });
  assertManuallyManageableTagName(userTag.tag.name);

  await prisma.$transaction(async (tx) => {
    await tx.userTag.update({
      where: { id: data.userTagId },
      data: {
        revokedAt: new Date(),
        revokedById: actor.id,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "TAG_REVOKE",
        entityType: "UserTag",
        entityId: userTag.id,
        details: { userId: userTag.userId, tagName: userTag.tag.name, projectId: userTag.projectId },
      },
    });
  });

  revalidatePath("/admin/tags");
  revalidatePath("/admin/users");
}

export type RevokeTagState = { ok: boolean; message: string | null };

export async function revokeTagFormAction(
  _prevState: RevokeTagState,
  formData: FormData,
): Promise<RevokeTagState> {
  try {
    await revokeTag({ userTagId: formData.get("userTagId") });
    return { ok: true, message: "Tag 已撤销" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "撤销失败" };
  }
}
