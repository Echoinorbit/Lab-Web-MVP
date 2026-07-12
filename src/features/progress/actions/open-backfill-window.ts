"use server";

import { getActionErrorMessage } from "@/shared/lib/action-result";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { progressBackfillInputSchema } from "@/shared/lib/validators/progress";

import { openProgressBackfillWindowForUser } from "../lib/backfill";

export async function openProgressBackfillWindow(input: unknown) {
  const manager = await requireActiveUser();
  const data = progressBackfillInputSchema.parse(input);
  await assertPermissionWithAudit({
    userId: manager.id,
    permission: PERMISSIONS.PROGRESS_BACKFILL,
    entityType: "ProgressBackfillWindow",
  });

  try {
    return await prisma.$transaction((tx) => openProgressBackfillWindowForUser(tx, {
      managerId: manager.id,
      ...data,
    }));
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: manager.id,
        permission: error.permission,
        entityType: "ProgressBackfillWindow",
      });
    }
    throw error;
  }
}

export type BackfillFormState = { ok: boolean; message: string | null };

export async function openBackfillWindowFormAction(
  _prevState: BackfillFormState,
  formData: FormData,
): Promise<BackfillFormState> {
  try {
    await openProgressBackfillWindow({
      userId: formData.get("userId"),
      year: Number(formData.get("year")),
      month: Number(formData.get("month")),
    });
    return { ok: true, message: "补填窗口已开启" };
  } catch (error) {
    return {
      ok: false,
      message: getActionErrorMessage(error, {
        fallbackMessage: "补填窗口开启失败，请稍后重试。",
        knownMessages: ["目标成员不存在或账号不可用。"],
      }),
    };
  }
}
