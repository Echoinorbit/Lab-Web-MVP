"use server";

import { revalidatePath } from "next/cache";

import { getProjectAdvisorLifecycleUserIds } from "@/features/projects/lib/project-responsibility";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { lockUserAdvisorRelations, orderUserLifecycleLockIds } from "@/shared/lib/user-lifecycle-lock";
import { updateUserStudyIdentityInputSchema } from "@/shared/lib/validators/admin";

import { applyStudyIdentityUpdate, lockUserIdentity } from "../lib/study-identity-service";
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
    await lockUserAdvisorRelations(tx);
    const relatedUserIds = await getProjectAdvisorLifecycleUserIds(tx, data.userId);
    for (const userId of orderUserLifecycleLockIds([actor.id, data.userId, ...relatedUserIds])) {
      await lockUserIdentity(tx, userId);
    }
    const result = await applyStudyIdentityUpdate(tx, {
      userId: data.userId,
      actorId: actor.id,
      studyDegree: data.studyDegree,
      studyGrade: data.studyGrade,
      confirmGraduatedRepair: data.confirmGraduatedRepair,
    });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        actorSnapshot: result.identitySync.actorSnapshot,
        action: "UPDATE",
        entityType: "User",
        entityId: data.userId,
        details: {
          before: {
            status: result.target.status,
            studyDegree: result.target.studyDegree,
            studyGrade: result.target.studyGrade,
            identityNeedsReview: result.target.identityNeedsReview,
          },
          after: {
            status: result.target.status,
            studyDegree: data.studyDegree,
            studyGrade: result.studyGrade,
            identityNeedsReview: false,
            graduatedAt: result.repairedGraduation?.graduatedAt.toISOString() ?? null,
            scheduledDeletionAt: result.repairedGraduation?.scheduledDeletionAt.toISOString() ?? null,
          },
          repairedGraduatedIdentity: result.repairingGraduatedIdentity,
          releasedAdviseeCount: result.identitySync.releasedAdviseeCount,
          releasedProjectLeaderIds: result.identitySync.reconciledProjectIds,
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
