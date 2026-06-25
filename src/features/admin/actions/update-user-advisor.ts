"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { updateUserAdvisorInputSchema } from "@/shared/lib/validators/admin";

export async function updateUserAdvisor(input: unknown) {
  const admin = await requireActiveUser();
  const data = updateUserAdvisorInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  if (data.advisorId) {
    await prisma.user.findUniqueOrThrow({
      where: { id: data.advisorId },
      select: { id: true },
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: data.userId },
      data: { advisorId: data.advisorId || null },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "ADVISOR_CHANGE",
        entityType: "User",
        entityId: data.userId,
        details: { advisorId: data.advisorId ?? null },
      },
    });
  });

  revalidatePath("/admin/users");
}
