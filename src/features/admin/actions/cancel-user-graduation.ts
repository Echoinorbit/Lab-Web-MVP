"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { cancelUserGraduationInputSchema } from "@/shared/lib/validators/admin";

import { cancelUserGraduation } from "../lib/user-lifecycle";

export async function cancelGraduation(input: unknown) {
  const actor = await requireActiveUser();
  const data = cancelUserGraduationInputSchema.parse(input);
  await assertPermissionWithAudit({
    userId: actor.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });
  await prisma.$transaction((tx) => cancelUserGraduation(tx, { actorId: actor.id, userId: data.userId }));
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${data.userId}/edit`);
  revalidatePath("/admin/tags");
}
