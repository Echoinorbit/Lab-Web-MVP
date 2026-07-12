"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { requireActiveUser } from "@/shared/lib/session";
import { prisma } from "@/shared/lib/prisma";
import { validatePasswordPolicy, verifyPasswordWithDummyFallback } from "@/shared/lib/security";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";
import { changePasswordSchema } from "@/shared/lib/validators/auth";

export async function changePassword(input: unknown) {
  const sessionUser = await requireActiveUser({ allowPasswordChange: true });
  const parsed = changePasswordSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    const actor = await getLockedActiveActor(tx, sessionUser.id);
    if (!actor) throw new Error("账号已失效，无法修改密码。");
    const user = await tx.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      select: { id: true, username: true, studentId: true, passwordHash: true },
    });
    const currentOk = await verifyPasswordWithDummyFallback(parsed.currentPassword, user.passwordHash);
    if (!currentOk) throw new Error("Current password is incorrect.");

    const policy = validatePasswordPolicy(parsed.newPassword, [user.username, user.studentId ?? ""]);
    if (!policy.ok) throw new Error(policy.errors.join(" "));

    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(parsed.newPassword, 12),
        mustChangePassword: false,
        tokenVersion: { increment: 1 },
      },
    });
    await tx.auditLog.createMany({
      data: [
        {
          userId: user.id,
          actorSnapshot: actor.actorSnapshot,
          action: "PASSWORD_CHANGE",
          entityType: "User",
          entityId: user.id,
        },
        {
          userId: user.id,
          actorSnapshot: actor.actorSnapshot,
          action: "SESSION_REVOKE",
          entityType: "User",
          entityId: user.id,
          details: { reason: "password-change" },
        },
      ],
    });
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
