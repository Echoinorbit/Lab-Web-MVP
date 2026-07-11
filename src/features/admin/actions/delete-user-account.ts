"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { removeManagedAvatar } from "@/shared/lib/avatar-storage";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { deleteUserAccountInputSchema } from "@/shared/lib/validators/admin";

import { deleteUserAccount } from "../lib/delete-user-account";

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
  if (result.deleted) await removeManagedAvatar(result.avatar).catch(() => undefined);

  revalidatePath("/");
  revalidatePath("/admin/users");
  revalidatePath("/admin/tags");
  revalidatePath("/admin/audit");
  revalidatePath("/projects");
  return result;
}
