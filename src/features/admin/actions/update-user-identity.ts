"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { lockUserLifecycle, orderUserLifecycleLockIds } from "@/shared/lib/user-lifecycle-lock";
import { updateUserIdentityInputSchema } from "@/shared/lib/validators/admin";

import { buildUserIdentityUpdateData } from "../lib/user-governance";
import { getDatabaseNow } from "../lib/user-lifecycle";
import { toUserActionResult } from "../lib/user-action-result";

function identityConflictMessage(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  const target = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [String(error.meta?.target ?? "")];
  if (target.some((field) => field.includes("username"))) return "用户名已存在，请使用其他用户名。";
  if (target.some((field) => field.includes("studentId"))) return "学号已存在，请检查是否重复。";
  return "用户名或学号已存在，请检查后重试。";
}

export async function updateUserIdentity(input: unknown) {
  const admin = await requireActiveUser();
  const data = updateUserIdentityInputSchema.parse(input);
  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
    entityId: data.userId,
  });

  try {
    await prisma.$transaction(async (tx) => {
      for (const userId of orderUserLifecycleLockIds([admin.id, data.userId])) {
        await lockUserLifecycle(tx, userId);
      }
      const [current, currentAdmin, now] = await Promise.all([
        tx.user.findUniqueOrThrow({
          where: { id: data.userId },
          select: { username: true, displayName: true, studentId: true },
        }),
        tx.user.findFirst({
          where: { id: admin.id, role: "ADMIN", status: "ACTIVE" },
          select: { displayName: true, studyDegree: true, status: true },
        }),
        getDatabaseNow(tx),
      ]);
      if (!currentAdmin) throw new Error("执行身份信息变更的管理员账号已失效。");
      await tx.user.update({
        where: { id: data.userId },
        data: buildUserIdentityUpdateData(current, data),
      });
      await tx.auditLog.create({
        data: {
          userId: admin.id,
          actorSnapshot: createActorSnapshot(currentAdmin, now),
          action: "UPDATE",
          entityType: "User",
          entityId: data.userId,
          details: {
            before: current,
            after: { username: data.username, displayName: data.displayName, studentId: data.studentId },
            usernameChanged: current.username !== data.username,
          },
        },
      });
    });
  } catch (error) {
    const conflictMessage = identityConflictMessage(error);
    if (conflictMessage) throw new Error(conflictMessage);
    throw error;
  }

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${data.userId}/edit`);
  revalidatePath("/profile");
}

export async function updateUserIdentityResult(input: unknown) {
  return toUserActionResult(async () => {
    await updateUserIdentity(input);
    return null;
  }, "用户资料更新失败，请稍后重试。");
}
