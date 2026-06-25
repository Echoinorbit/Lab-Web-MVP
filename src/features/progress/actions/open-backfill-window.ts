"use server";

import { appendAuditLog } from "@/shared/lib/audit";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { getProgressBackfillExpiresAt } from "@/shared/lib/date";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { progressBackfillInputSchema } from "@/shared/lib/validators/progress";

export async function openProgressBackfillWindow(input: unknown) {
  const manager = await requireActiveUser();
  const data = progressBackfillInputSchema.parse(input);
  await assertPermissionWithAudit({
    userId: manager.id,
    permission: PERMISSIONS.PROGRESS_BACKFILL,
    entityType: "ProgressBackfillWindow",
  });

  const expiresAt = getProgressBackfillExpiresAt();
  const window = await prisma.progressBackfillWindow.upsert({
    where: {
      userId_year_month: {
        userId: data.userId,
        year: data.year,
        month: data.month,
      },
    },
    create: {
      userId: data.userId,
      year: data.year,
      month: data.month,
      openedById: manager.id,
      expiresAt,
    },
    update: {
      openedById: manager.id,
      expiresAt,
      usedAt: null,
    },
  });

  await appendAuditLog({
    userId: manager.id,
    action: "PROGRESS_BACKFILL",
    entityType: "ProgressBackfillWindow",
    entityId: window.id,
    details: {
      studentUserId: data.userId,
      year: data.year,
      month: data.month,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return window;
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
    return { ok: false, message: error instanceof Error ? error.message : "开启失败" };
  }
}
