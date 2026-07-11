"use server";

import { revalidatePath } from "next/cache";

import { toActionResult } from "@/shared/lib/action-result";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { computePermissionsFromSnapshot, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { updateAnnouncementInputSchema } from "@/shared/lib/validators/announcements";

import { resolveAnnouncementUpdateAccess } from "../lib/access";

export async function updateAnnouncement(input: unknown) {
  const actor = await requireActiveUser();
  const data = updateAnnouncementInputSchema.parse(input);
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Announcement" WHERE "id" = ${data.id} FOR UPDATE`;
      const [current, currentActor, [{ now }]] = await Promise.all([
        tx.announcement.findFirst({
          where: { id: data.id, deletedAt: null },
          select: {
            authorId: true,
            title: true,
            content: true,
            isPinned: true,
            isUrgent: true,
          },
        }),
        tx.user.findUnique({
          where: { id: actor.id },
          select: {
            role: true,
            status: true,
            displayName: true,
            studyDegree: true,
            tags: {
              where: { revokedAt: null },
              select: {
                projectId: true,
                expiresAt: true,
                revokedAt: true,
                tag: {
                  select: {
                    name: true,
                    permissions: true,
                    template: { select: { permissions: true } },
                  },
                },
              },
            },
          },
        }),
        tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
      ]);
      if (!current) throw new Error("公告不存在或已删除。");
      if (!currentActor) throw new PermissionDeniedError(PERMISSIONS.ANNOUNCEMENT_UPDATE);

      const permissions = computePermissionsFromSnapshot(currentActor, now);
      const access = resolveAnnouncementUpdateAccess({
        actorId: actor.id,
        actorRole: currentActor.role,
        authorId: current.authorId,
        permissions,
      });
      if (!access.allowed) throw new PermissionDeniedError(PERMISSIONS.ANNOUNCEMENT_UPDATE);

      const row = await tx.announcement.update({
        where: { id: data.id },
        data: {
          title: data.title,
          content: data.content,
          isPinned: data.isPinned,
          isUrgent: data.isUrgent,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot: createActorSnapshot(currentActor, now),
          action: "UPDATE",
          entityType: "Announcement",
          entityId: data.id,
          details: {
            scope: access.scope,
            before: {
              title: current.title,
              content: current.content,
              isPinned: current.isPinned,
              isUrgent: current.isUrgent,
            },
            after: {
              title: data.title,
              content: data.content,
              isPinned: data.isPinned,
              isUrgent: data.isUrgent,
            },
          },
        },
      });
      return row;
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: actor.id,
        permission: error.permission,
        entityType: "Announcement",
        entityId: data.id,
      });
    }
    throw error;
  }

  revalidatePath("/");
  revalidatePath("/announcements");
  revalidatePath(`/announcements/${data.id}`);
  revalidatePath(`/announcements/${data.id}/edit`);
  return updated;
}

export async function updateAnnouncementResult(input: unknown) {
  return toActionResult(async () => {
    await updateAnnouncement(input);
    return null;
  }, {
    fallbackMessage: "公告保存失败，请稍后重试。",
    knownMessages: ["公告不存在或已删除。"],
  });
}
