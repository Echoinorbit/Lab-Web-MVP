"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { updateUserAdvisorInputSchema } from "@/shared/lib/validators/admin";

import { canAssignAdvisorToTarget } from "../lib/user-governance";
import { ADVISOR_TAG_NAME } from "@/shared/lib/system-tags";

export async function updateUserAdvisor(input: unknown) {
  const admin = await requireActiveUser();
  const data = updateUserAdvisorInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const target = await tx.user.findUniqueOrThrow({
      where: { id: data.userId },
      select: {
        role: true,
        status: true,
        tags: {
          where: {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            tag: { name: ADVISOR_TAG_NAME },
          },
          select: { id: true },
        },
      },
    });
    if (target.status !== "ACTIVE") throw new Error("仅可为在用成员设置导师。");
    if (!canAssignAdvisorToTarget({ role: target.role, hasAdvisorTag: target.tags.length > 0 })) {
      throw new Error("管理员和导师账号不需要设置导师。");
    }
    if (data.advisorId) {
      const advisor = await tx.user.findFirst({
        where: {
          id: data.advisorId,
          role: "MEMBER",
          status: "ACTIVE",
          tags: {
            some: {
              revokedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              tag: { name: ADVISOR_TAG_NAME },
            },
          },
        },
        select: { id: true },
      });
      if (!advisor) throw new Error("所选导师不存在或导师资格已失效。");
    }
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
