"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { toActionResult } from "@/shared/lib/action-result";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { getUserPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

const deleteAnnouncementInputSchema = z.object({
  id: z.string().min(1),
});

export async function deleteAnnouncement(input: unknown) {
  const user = await requireActiveUser();
  const data = deleteAnnouncementInputSchema.parse(input);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Announcement" WHERE "id" = ${data.id} FOR UPDATE`;
      const [[{ now }], current, actor] = await Promise.all([
        tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
        tx.announcement.findFirst({ where: { id: data.id, deletedAt: null }, select: { id: true } }),
        tx.user.findUnique({
          where: { id: user.id },
          select: { role: true, status: true, displayName: true, studyDegree: true },
        }),
      ]);
      const permissions = await getUserPermissionsForClient(tx, user.id, now);
      if (!actor || actor.status !== "ACTIVE" || !permissions.has(PERMISSIONS.ANNOUNCEMENT_DELETE)) {
        throw new PermissionDeniedError(PERMISSIONS.ANNOUNCEMENT_DELETE);
      }
      if (!current) throw new Error("公告不存在或已删除。");
      await tx.announcement.update({ where: { id: current.id }, data: { deletedAt: now } });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorSnapshot: createActorSnapshot(actor, now),
          action: "DELETE",
          entityType: "Announcement",
          entityId: data.id,
        },
      });
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: user.id,
        permission: error.permission,
        entityType: "Announcement",
        entityId: data.id,
      });
    }
    throw error;
  }

  revalidatePath("/announcements");
}

export async function deleteAnnouncementFormAction(formData: FormData): Promise<void> {
  await deleteAnnouncement({ id: formData.get("id") });
}

export async function deleteAnnouncementResult(input: unknown) {
  return toActionResult(async () => {
    await deleteAnnouncement(input);
    return null;
  }, {
    fallbackMessage: "公告删除失败，请稍后重试。",
    knownMessages: ["公告不存在或已删除。"],
  });
}
