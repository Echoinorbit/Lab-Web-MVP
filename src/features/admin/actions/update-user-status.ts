"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { updateUserStatusInputSchema } from "@/shared/lib/validators/admin";

import { applyAdminUserStatusUpdate } from "../lib/user-status-management";

export async function updateUserStatus(input: unknown) {
  const admin = await requireActiveUser();
  const data = updateUserStatusInputSchema.parse(input);
  if (admin.id === data.userId && data.status !== "ACTIVE") {
    throw new Error("管理员不能停用或毕业自己的账号。");
  }

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  await prisma.$transaction(async (tx) => {
    await applyAdminUserStatusUpdate(tx, {
      adminId: admin.id,
      userId: data.userId,
      status: data.status,
    });
  });

  revalidatePath("/admin/users");
}
