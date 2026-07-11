"use server";

import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { enrollmentDateForGrade } from "@/shared/lib/grade";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { STUDY_GRADE_LABELS } from "@/shared/lib/study-identity";
import { updateUserStudyIdentityInputSchema } from "@/shared/lib/validators/admin";

import { lockUserIdentity, syncStudyIdentity } from "../lib/study-identity-service";
import { orderUserLifecycleLockIds } from "../lib/user-lifecycle";
import { toUserActionResult } from "../lib/user-action-result";

export async function updateUserStudyIdentity(input: unknown) {
  const actor = await requireActiveUser();
  const data = updateUserStudyIdentityInputSchema.parse(input);
  await assertPermissionWithAudit({
    userId: actor.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  await prisma.$transaction(async (tx) => {
    for (const userId of orderUserLifecycleLockIds([actor.id, data.userId])) {
      await lockUserIdentity(tx, userId);
    }
    const target = await tx.user.findUnique({
      where: { id: data.userId },
      select: { role: true, status: true, studyDegree: true, studyGrade: true },
    });
    if (!target) throw new Error("用户不存在。");
    if (target.role !== "MEMBER") throw new Error("管理员账号不能设置培养身份。");
    if (target.status === "GRADUATED") throw new Error("请先取消毕业，再修改培养身份。");

    const studyGrade = data.studyGrade ?? null;
    const enrollmentDate = studyGrade
      ? enrollmentDateForGrade(
          data.studyDegree === "MASTER" ? "master" : "phd",
          STUDY_GRADE_LABELS[studyGrade],
        )
      : null;
    const identitySync = await syncStudyIdentity(tx, {
      userId: data.userId,
      actorId: actor.id,
      role: "MEMBER",
      studyDegree: data.studyDegree,
      studyGrade,
    });
    await tx.user.update({ where: { id: data.userId }, data: { enrollmentDate } });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        actorSnapshot: identitySync.actorSnapshot,
        action: "UPDATE",
        entityType: "User",
        entityId: data.userId,
        details: {
          before: { studyDegree: target.studyDegree, studyGrade: target.studyGrade },
          after: { studyDegree: data.studyDegree, studyGrade },
        },
      },
    });
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${data.userId}/edit`);
  revalidatePath("/admin/tags");
  revalidatePath("/profile");
}

export async function updateUserStudyIdentityResult(input: unknown) {
  return toUserActionResult(async () => {
    await updateUserStudyIdentity(input);
    return null;
  }, "培养身份更新失败，请稍后重试。");
}
