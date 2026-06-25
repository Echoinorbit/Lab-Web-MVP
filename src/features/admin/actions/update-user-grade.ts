"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { enrollmentDateForGrade, resolveGradeTrackFromTagNames } from "@/shared/lib/grade";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { updateUserGradeInputSchema } from "@/shared/lib/validators/admin";

export async function updateUserGrade(input: unknown) {
  const admin = await requireActiveUser();
  const data = updateUserGradeInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const user = await tx.user.findUnique({
      where: { id: data.userId },
      select: {
        tags: {
          where: {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: {
            projectId: true,
            tag: { select: { name: true } },
          },
        },
      },
    });
    if (!user) {
      throw new Error("用户不存在。");
    }

    const tagNames = user.tags.filter((userTag) => !userTag.projectId).map((userTag) => userTag.tag.name);
    const track = resolveGradeTrackFromTagNames(tagNames);
    if (!track) {
      throw new Error("请先授予硕士或博士 Tag 后再设置年级。");
    }

    const enrollmentDate = enrollmentDateForGrade(track, data.grade, now);

    await tx.user.update({
      where: { id: data.userId },
      data: {
        grade: data.grade,
        enrollmentDate,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "UPDATE",
        entityType: "User",
        entityId: data.userId,
        details: { grade: data.grade, enrollmentDate: enrollmentDate.toISOString() },
      },
    });
  });

  revalidatePath("/admin/users");
}
