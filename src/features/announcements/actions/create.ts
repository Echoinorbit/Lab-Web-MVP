"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActionErrorMessage } from "@/shared/lib/action-result";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { includeActiveAdminsInNotificationRecipients } from "@/features/notifications/lib/recipients";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { enforceRateLimit } from "@/shared/lib/rate-limits";
import { getUserPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";
import { splitCommaList } from "@/shared/lib/utils";
import { announcementInputSchema } from "@/shared/lib/validators/announcements";

import { ANNOUNCEMENT_LIST_ROUTE } from "../lib/access";
import {
  resolveProjectAnnouncementRecipientIds,
  uniqueAnnouncementRecipientIds,
} from "../lib/recipients";
import { getDefaultAnnouncementExpiresAt } from "../lib/visibility";

async function resolveAnnouncementRecipients(
  client: Pick<Prisma.TransactionClient, "user" | "project" | "projectMember" | "userTag">,
  targetType: "ALL" | "PROJECT" | "TAG" | "USERS",
  targetIds: string[],
  authorId: string,
  now: Date,
) {
  if (targetType === "ALL") {
    const users = await client.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    return uniqueAnnouncementRecipientIds(users.map((user) => user.id), authorId);
  }

  if (targetType === "USERS") {
    const users = await client.user.findMany({
      where: { id: { in: targetIds }, status: "ACTIVE" },
      select: { id: true },
    });
    return uniqueAnnouncementRecipientIds(users.map((user) => user.id), authorId);
  }

  if (targetType === "PROJECT") {
    const [members, projects] = await Promise.all([
      client.projectMember.findMany({
        where: {
          projectId: { in: targetIds },
          project: { deletedAt: null },
          user: { status: "ACTIVE" },
        },
        select: { userId: true },
      }),
      client.project.findMany({
        where: {
          id: { in: targetIds },
          deletedAt: null,
          leaderId: { not: null },
          leader: { status: "ACTIVE" },
        },
        select: { leaderId: true },
      }),
    ]);
    return resolveProjectAnnouncementRecipientIds({
      memberUserIds: members.flatMap((member) => member.userId ? [member.userId] : []),
      leadUserIds: projects.flatMap((project) => project.leaderId ? [project.leaderId] : []),
      authorId,
    });
  }

  const userTags = await client.userTag.findMany({
    where: {
      tagId: { in: targetIds },
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      user: { status: "ACTIVE" },
    },
    select: { userId: true },
  });
  return uniqueAnnouncementRecipientIds(userTags.map((userTag) => userTag.userId), authorId);
}

export async function createAnnouncement(input: unknown) {
  const user = await requireActiveUser();
  const data = announcementInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.ANNOUNCEMENT_CREATE,
    entityType: "Announcement",
  });
  if (data.targetType !== "ALL") {
    await assertPermissionWithAudit({
      userId: user.id,
      permission: PERMISSIONS.ANNOUNCEMENT_NOTIFY_TARGETED,
      entityType: "Announcement",
    });
  }

  let announcement: { id: string };
  try {
    announcement = await prisma.$transaction(async (tx) => {
      const access = await getLockedActiveActor(tx, user.id);
      const currentPermissions = await getUserPermissionsForClient(tx, user.id, access?.now);
      const missingPermission = !currentPermissions.has(PERMISSIONS.ANNOUNCEMENT_CREATE)
        ? PERMISSIONS.ANNOUNCEMENT_CREATE
        : data.targetType !== "ALL" && !currentPermissions.has(PERMISSIONS.ANNOUNCEMENT_NOTIFY_TARGETED)
          ? PERMISSIONS.ANNOUNCEMENT_NOTIFY_TARGETED
          : null;
      if (!access || missingPermission) {
        throw new PermissionDeniedError(missingPermission ?? PERMISSIONS.ANNOUNCEMENT_CREATE);
      }

      const { actorSnapshot, now } = access;
      await enforceRateLimit(tx, user.id, PERMISSIONS.ANNOUNCEMENT_CREATE, now);
      const domainRecipientIds = await resolveAnnouncementRecipients(
        tx,
        data.targetType,
        data.targetIds,
        user.id,
        now,
      );
      const recipientIds = await includeActiveAdminsInNotificationRecipients(tx, {
        recipientIds: domainRecipientIds,
        actorId: user.id,
      });

      const created = await tx.announcement.create({
        data: {
          title: data.title,
          content: data.content,
          authorId: user.id,
          authorSnapshot: actorSnapshot,
          isPinned: data.isPinned,
          isUrgent: data.isUrgent,
          targetType: data.targetType,
          targetIds: data.targetType === "ALL" ? [] : data.targetIds,
          expiresAt: getDefaultAnnouncementExpiresAt(now),
        },
      });

      if (recipientIds.length > 0) {
        await tx.notification.createMany({
          data: recipientIds.map((recipientId) => ({
            userId: recipientId,
            senderId: user.id,
            senderSnapshot: actorSnapshot,
            type: data.isUrgent ? "ANNOUNCEMENT_URGENT" : "ANNOUNCEMENT_NEW",
            title: data.title,
            content: data.content.slice(0, 240),
            relatedType: "ANNOUNCEMENT",
            relatedId: created.id,
          })),
          skipDuplicates: true,
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorSnapshot,
          action: "CREATE",
          entityType: "Announcement",
          entityId: created.id,
          details: { targetType: data.targetType, recipientCount: recipientIds.length },
        },
      });

      return created;
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: user.id,
        permission: error.permission,
        entityType: "Announcement",
      });
    }
    throw error;
  }

  revalidatePath("/announcements");
  return announcement;
}

export type AnnouncementFormState = { ok: boolean; message: string | null };

export async function createAnnouncementFormAction(
  _prevState: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  const targetIds = splitCommaList(String(formData.get("targetIds") ?? ""));
  try {
    await createAnnouncement({
      title: formData.get("title"),
      content: formData.get("content"),
      isUrgent: formData.get("isUrgent") === "on",
      isPinned: formData.get("isPinned") === "on",
      targetType: formData.get("targetType"),
      targetIds,
    });
  } catch (error) {
    return {
      ok: false,
      message: getActionErrorMessage(error, { fallbackMessage: "公告发布失败，请稍后重试。" }),
    };
  }
  redirect(ANNOUNCEMENT_LIST_ROUTE);
}
