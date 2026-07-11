"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { appendAuditLog } from "@/shared/lib/audit";
import { requireActiveUser } from "@/shared/lib/session";
import { prisma } from "@/shared/lib/prisma";
import { validatePasswordPolicy, verifyPasswordWithDummyFallback } from "@/shared/lib/security";
import { changePasswordSchema } from "@/shared/lib/validators/auth";

export async function changePassword(input: unknown) {
  const sessionUser = await requireActiveUser({ allowPasswordChange: true });
  const parsed = changePasswordSchema.parse(input);

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: {
      id: true,
      username: true,
      studentId: true,
      passwordHash: true,
      displayName: true,
      studyDegree: true,
      status: true,
    },
  });

  const currentOk = await verifyPasswordWithDummyFallback(parsed.currentPassword, user.passwordHash);
  if (!currentOk) {
    throw new Error("Current password is incorrect.");
  }

  const policy = validatePasswordPolicy(parsed.newPassword, [user.username, user.studentId ?? ""]);
  if (!policy.ok) {
    throw new Error(policy.errors.join(" "));
  }

  const actorSnapshot = createActorSnapshot(user);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(parsed.newPassword, 12),
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        actorSnapshot,
        action: "PASSWORD_CHANGE",
        entityType: "User",
        entityId: user.id,
      },
    }),
  ]);

  await appendAuditLog({
    userId: user.id,
    action: "SESSION_REVOKE",
    entityType: "User",
    entityId: user.id,
    details: { reason: "password-change" },
  });
}

export type ChangePasswordFormState = { ok: boolean; message: string | null };

export async function changePasswordFormAction(
  _prevState: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  try {
    await changePassword({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
  } catch {
    return { ok: false, message: "密码修改失败，请检查当前密码和新密码强度。" };
  }
  // tokenVersion was incremented, so the current session is now invalid; send the
  // user back to login. redirect() must run outside the try/catch (it throws).
  redirect("/login");
}
