"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { getActionErrorMessage } from "@/shared/lib/action-result";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { enrollmentDateForGrade } from "@/shared/lib/grade";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { validatePasswordPolicy } from "@/shared/lib/security";
import { requireActiveUser } from "@/shared/lib/session";
import {
  lockUserAdvisorRelations,
  lockUserLifecycle,
  orderUserLifecycleLockIds,
} from "@/shared/lib/user-lifecycle-lock";
import { STUDY_GRADE_LABELS } from "@/shared/lib/study-identity";
import { createUserInputSchema } from "@/shared/lib/validators/admin";

import { syncStudyIdentity } from "../lib/study-identity-service";

class CreateUserFeedbackError extends Error {}

export async function createUser(input: unknown) {
  const admin = await requireActiveUser();
  const data = createUserInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
  });

  const passwordCheck = validatePasswordPolicy(data.password, [data.username, data.studentId ?? ""]);
  if (!passwordCheck.ok) {
    throw new CreateUserFeedbackError(passwordCheck.errors.join(" "));
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    await lockUserAdvisorRelations(tx);
    for (const userId of orderUserLifecycleLockIds([
      admin.id,
      ...(data.advisorId ? [data.advisorId] : []),
    ])) {
      await lockUserLifecycle(tx, userId);
    }
    const [[{ now }], advisor] = await Promise.all([
      tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
      data.advisorId
        ? tx.user.findFirst({
        where: {
          id: data.advisorId,
          role: "MEMBER",
          status: "ACTIVE",
          studyDegree: "MENTOR",
          identityNeedsReview: false,
        },
          select: { id: true, displayName: true, studyDegree: true, status: true },
        })
        : Promise.resolve(null),
    ]);
    if (data.advisorId && !advisor) throw new CreateUserFeedbackError("所选导师不存在或导师资格已失效。");
    const created = await tx.user.create({
      data: {
        username: data.username,
        displayName: data.displayName,
        studentId: data.studentId || null,
        studyDegree: data.studyDegree,
        studyGrade: data.studyGrade ?? null,
        enrollmentDate: data.studyGrade
          ? enrollmentDateForGrade(
              data.studyDegree === "MASTER" ? "master" : "phd",
              STUDY_GRADE_LABELS[data.studyGrade],
            )
          : null,
        advisorId: data.advisorId || null,
        ...(advisor ? { advisorSnapshot: createActorSnapshot(advisor, now) } : {}),
        passwordHash,
        role: "MEMBER",
        mustChangePassword: true,
      },
    });

    const identitySync = await syncStudyIdentity(tx, {
      userId: created.id,
      actorId: admin.id,
      role: "MEMBER",
      studyDegree: data.studyDegree,
      studyGrade: data.studyGrade ?? null,
    });

    await tx.auditLog.create({
      data: {
        userId: admin.id,
        actorSnapshot: identitySync.actorSnapshot,
        action: "CREATE",
        entityType: "User",
        entityId: created.id,
        details: {
          username: created.username,
          role: created.role,
          studyDegree: data.studyDegree,
          studyGrade: data.studyGrade ?? null,
        },
      },
    });

    return created;
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/tags");
  return { id: user.id };
}

export type CreateUserFormState = { ok: boolean; message: string | null };

function formatCreateUserError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
    if (target.includes("username")) return "用户名已存在，请换一个用户名。";
    if (target.includes("studentId")) return "学号已存在，请检查是否重复创建。";
    return "用户唯一字段重复，请检查用户名或学号。";
  }
  if (error instanceof CreateUserFeedbackError) return error.message;
  return getActionErrorMessage(error, { fallbackMessage: "成员创建失败，请稍后重试。" });
}

export async function createUserFormAction(
  _prevState: CreateUserFormState,
  formData: FormData,
): Promise<CreateUserFormState> {
  try {
    await createUser({
      username: formData.get("username"),
      displayName: formData.get("displayName"),
      password: formData.get("password"),
      studentId: formData.get("studentId") || undefined,
      studyDegree: formData.get("studyDegree"),
      studyGrade: formData.get("studyGrade") || undefined,
      advisorId: formData.get("advisorId") || undefined,
    });
    return { ok: true, message: "成员已创建" };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: formatCreateUserError(error) };
  }
}
