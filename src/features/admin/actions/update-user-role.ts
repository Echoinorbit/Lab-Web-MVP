"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { updateUserRoleInputSchema } from "@/shared/lib/validators/admin";

export async function updateUserRole(input: unknown) {
  const admin = await requireActiveUser();
  const data = updateUserRoleInputSchema.parse(input);
  if (admin.id === data.userId && data.role !== "ADMIN") {
    throw new Error("Admins cannot remove their own admin role.");
  }

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: data.userId },
      data: { role: data.role, tokenVersion: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "ROLE_CHANGE",
        entityType: "User",
        entityId: data.userId,
        details: { role: data.role },
      },
    });
  });

  revalidatePath("/admin/users");
}
