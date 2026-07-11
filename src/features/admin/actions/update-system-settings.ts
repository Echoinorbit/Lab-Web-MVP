"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { getActionErrorMessage } from "@/shared/lib/action-result";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { assertRuntimeSettings, SYSTEM_SETTING_ID } from "@/shared/lib/system-settings";
import { updateSystemSettingsInputSchema } from "@/shared/lib/validators/admin";

import { parseSystemSettingsRevision, parseSystemSettingsTime } from "../lib/system-settings-form";

export async function updateSystemSettings(input: unknown) {
  const actor = await requireActiveUser();
  const data = updateSystemSettingsInputSchema.parse(input);
  assertRuntimeSettings(data);
  await assertPermissionWithAudit({
    userId: actor.id,
    permission: PERMISSIONS.ADMIN_SETTINGS,
    entityType: "SystemSetting",
    entityId: SYSTEM_SETTING_ID,
  });

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "SystemSetting" WHERE "id" = ${SYSTEM_SETTING_ID} FOR UPDATE
      `);
      const [current, editor, [{ now }]] = await Promise.all([
        tx.systemSetting.findUniqueOrThrow({ where: { id: SYSTEM_SETTING_ID } }),
        tx.user.findFirst({
          where: { id: actor.id, role: "ADMIN", status: "ACTIVE" },
          select: { displayName: true, studyDegree: true, status: true },
        }),
        tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT transaction_timestamp() AS now`),
      ]);
      if (!editor) throw new PermissionDeniedError(PERMISSIONS.ADMIN_SETTINGS);
      if (current.revision !== data.revision) throw new Error("设置已被其他管理员更新，请刷新后重试。");

      const sessionPolicyChanged = current.sessionHours !== data.sessionHours;
      const updatedBySnapshot = createActorSnapshot(editor, now);
      const updated = await tx.systemSetting.update({
        where: { id: SYSTEM_SETTING_ID },
        data: {
          progressStartDay: data.progressStartDay,
          progressStartMinute: data.progressStartMinute,
          progressEndDay: data.progressEndDay,
          progressEndMinute: data.progressEndMinute,
          sessionHours: data.sessionHours,
          revision: { increment: 1 },
          updatedById: actor.id,
          updatedBySnapshot,
        },
      });
      const revokedSessionCount = sessionPolicyChanged
        ? (await tx.user.updateMany({ data: { tokenVersion: { increment: 1 } } })).count
        : 0;

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot: updatedBySnapshot,
          action: "UPDATE",
          entityType: "SystemSetting",
          entityId: SYSTEM_SETTING_ID,
          details: {
            before: {
              progressStartDay: current.progressStartDay,
              progressStartMinute: current.progressStartMinute,
              progressEndDay: current.progressEndDay,
              progressEndMinute: current.progressEndMinute,
              sessionHours: current.sessionHours,
              revision: current.revision,
            },
            after: {
              progressStartDay: updated.progressStartDay,
              progressStartMinute: updated.progressStartMinute,
              progressEndDay: updated.progressEndDay,
              progressEndMinute: updated.progressEndMinute,
              sessionHours: updated.sessionHours,
              revision: updated.revision,
            },
            revokedSessionCount,
          },
        },
      });
      return updated;
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: actor.id,
        permission: error.permission,
        entityType: "SystemSetting",
        entityId: SYSTEM_SETTING_ID,
      });
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/admin/settings");
  revalidatePath("/progress");
  return result;
}

export type SystemSettingsState = { ok: boolean; message: string | null };

const systemSettingsFeedbackMessages = [
  "进度窗口日期或时间无效。",
  "进度窗口结束时间必须晚于开始时间。",
  "会话时长必须在 1 到 720 小时之间。",
  "设置已被其他管理员更新，请刷新后重试。",
] as const;

export async function updateSystemSettingsFormAction(
  _previous: SystemSettingsState,
  formData: FormData,
): Promise<SystemSettingsState> {
  try {
    await updateSystemSettings({
      revision: parseSystemSettingsRevision(formData.get("revision")),
      progressStartDay: Number(formData.get("progressStartDay")),
      progressStartMinute: formData.has("progressStartTime")
        ? parseSystemSettingsTime(formData.get("progressStartTime"))
        : Number(formData.get("progressStartMinute")),
      progressEndDay: Number(formData.get("progressEndDay")),
      progressEndMinute: formData.has("progressEndTime")
        ? parseSystemSettingsTime(formData.get("progressEndTime"))
        : Number(formData.get("progressEndMinute")),
      sessionHours: Number(formData.get("sessionHours")),
    });
    return { ok: true, message: "系统设置已保存；会话策略变更会要求所有用户重新登录。" };
  } catch (error) {
    unstable_rethrow(error);
    return {
      ok: false,
      message: getActionErrorMessage(error, {
        fallbackMessage: "系统设置保存失败，请检查日期、时间与会话时长后重试。",
        knownMessages: systemSettingsFeedbackMessages,
      }),
    };
  }
}
