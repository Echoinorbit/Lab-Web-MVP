"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { defaultEnrollmentDate } from "@/shared/lib/grade";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { validatePasswordPolicy } from "@/shared/lib/security";
import { requireActiveUser } from "@/shared/lib/session";
import { createUserInputSchema } from "@/shared/lib/validators/admin";

export async function createUser(input: unknown) {
  const admin = await requireActiveUser();
  const data = createUserInputSchema.parse(input);
  const now = new Date();

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
  });

  const passwordCheck = validatePasswordPolicy(data.password, [data.username, data.studentId ?? ""]);
  if (!passwordCheck.ok) {
    throw new Error(passwordCheck.errors.join(" "));
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        username: data.username,
        displayName: data.displayName,
        studentId: data.studentId || null,
        grade: data.grade || null,
        enrollmentDate: defaultEnrollmentDate(now),
        advisorId: data.advisorId || null,
        passwordHash: await bcrypt.hash(data.password, 12),
        role: "MEMBER",
        mustChangePassword: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: admin.id,
        action: "CREATE",
        entityType: "User",
        entityId: created.id,
        details: { username: created.username, role: created.role },
      },
    });

    return created;
  });

  revalidatePath("/admin/users");
  return { id: user.id };
}

export type CreateUserFormState = { ok: boolean; message: string | null };

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
      grade: formData.get("grade") || undefined,
      advisorId: formData.get("advisorId") || undefined,
    });
    return { ok: true, message: "成员已创建" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "创建失败" };
  }
}
