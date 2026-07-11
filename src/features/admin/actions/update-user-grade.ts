"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { enrollmentDateForGrade } from "@/shared/lib/grade";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { STUDY_GRADE_LABELS } from "@/shared/lib/study-identity";
import { updateUserGradeInputSchema } from "@/shared/lib/validators/admin";

import { lockUserIdentity, syncStudyIdentity } from "../lib/study-identity-service";

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
    await lockUserIdentity(tx, data.userId);
    const user = await tx.user.findUnique({
      where: { id: data.userId },
      select: {
        role: true,
        status: true,
        studyDegree: true,
        identityNeedsReview: true,
      },
    });
    if (!user) {
      throw new Error("用户不存在。");
    }

    if (user.role !== "MEMBER" || user.identityNeedsReview || !user.studyDegree || user.studyDegree === "MENTOR") {
      throw new Error("仅可为身份已确认的硕士或博士成员设置年级。");
    }
    if (user.status === "GRADUATED") throw new Error("已毕业账号不能修改年级。");

    const enrollmentDate = enrollmentDateForGrade(
      user.studyDegree === "MASTER" ? "master" : "phd",
      STUDY_GRADE_LABELS[data.studyGrade],
    );

    const identitySync = await syncStudyIdentity(tx, {
      userId: data.userId,
      actorId: admin.id,
      role: user.role,
      studyDegree: user.studyDegree,
      studyGrade: data.studyGrade,
    });
    await tx.user.update({ where: { id: data.userId }, data: { enrollmentDate } });
    await tx.auditLog.create({
      data: {
        userId: admin.id,
        actorSnapshot: identitySync.actorSnapshot,
        action: "UPDATE",
        entityType: "User",
        entityId: data.userId,
        details: { studyGrade: data.studyGrade, enrollmentDate: enrollmentDate.toISOString() },
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/tags");
}
