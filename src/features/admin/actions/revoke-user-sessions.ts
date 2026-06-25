"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { revokeUserSessionsInputSchema } from "@/shared/lib/validators/admin";

export async function revokeUserSessions(input: unknown) {
  const admin = await requireActiveUser();
  const data = revokeUserSessionsInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: data.userId },
      data: { tokenVersion: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "SESSION_REVOKE",
        entityType: "User",
        entityId: data.userId,
      },
    });
  });

  revalidatePath("/admin/users");
}
