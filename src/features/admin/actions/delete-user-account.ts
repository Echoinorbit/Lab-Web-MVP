"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { removeManagedAvatar } from "@/shared/lib/avatar-storage";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { deleteUserAccountInputSchema } from "@/shared/lib/validators/admin";

import { deleteUserAccount } from "../lib/delete-user-account";
import { toUserActionResult } from "../lib/user-action-result";

export async function permanentlyDeleteUser(input: unknown) {
  const actor = await requireActiveUser();
  const data = deleteUserAccountInputSchema.parse(input);
  await assertPermissionWithAudit({
    userId: actor.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });
  const result = await prisma.$transaction((tx) => deleteUserAccount(tx, data.userId, {
    kind: "manual",
    actorId: actor.id,
    confirmUsername: data.confirmUsername,
  }));
  let avatarCleanupPending = false;
  if (result.deleted) {
    try {
      await removeManagedAvatar(result.avatar);
    } catch {
      avatarCleanupPending = true;
    }
  }

  revalidatePath("/");
  revalidatePath("/admin/users");
  revalidatePath("/admin/tags");
  revalidatePath("/admin/audit");
  revalidatePath("/projects");
  return { ...result, avatarCleanupPending };
}

export async function permanentlyDeleteUserResult(input: unknown) {
  return toUserActionResult(() => permanentlyDeleteUser(input), "永久删除用户失败，请稍后重试。");
}
