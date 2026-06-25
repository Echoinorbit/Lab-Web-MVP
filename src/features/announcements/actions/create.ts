"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { enforceRateLimit } from "@/shared/lib/rate-limits";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { splitCommaList } from "@/shared/lib/utils";
import { announcementInputSchema } from "@/shared/lib/validators/announcements";

import { ANNOUNCEMENT_LIST_ROUTE } from "../lib/access";
import {
  projectLeadTagName,
  resolveProjectAnnouncementRecipientIds,
  uniqueAnnouncementRecipientIds,
} from "../lib/recipients";

async function resolveAnnouncementRecipients(targetType: "ALL" | "PROJECT" | "TAG" | "USERS", targetIds: string[], authorId: string) {
  const now = new Date();

  if (targetType === "ALL") {
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    return uniqueAnnouncementRecipientIds(users.map((user) => user.id), authorId);
  }

  if (targetType === "USERS") {
    const users = await prisma.user.findMany({
      where: { id: { in: targetIds }, status: "ACTIVE" },
      select: { id: true },
    });
    return uniqueAnnouncementRecipientIds(users.map((user) => user.id), authorId);
  }

  if (targetType === "PROJECT") {
    const [members, leadGrants] = await Promise.all([
      prisma.projectMember.findMany({
        where: {
          projectId: { in: targetIds },
          project: { deletedAt: null },
          user: { status: "ACTIVE" },
        },
        select: { userId: true },
      }),
      prisma.userTag.findMany({
        where: {
          projectId: { in: targetIds },
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          tag: { name: { in: targetIds.map(projectLeadTagName) } },
          user: { status: "ACTIVE" },
        },
        select: { userId: true },
      }),
    ]);
    return resolveProjectAnnouncementRecipientIds({
      memberUserIds: members.map((member) => member.userId),
      leadUserIds: leadGrants.map((grant) => grant.userId),
      authorId,
    });
  }

  const userTags = await prisma.userTag.findMany({
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

  const recipientIds = await resolveAnnouncementRecipients(data.targetType, data.targetIds, user.id);

  const announcement = await prisma.$transaction(async (tx) => {
    await enforceRateLimit(tx, user.id, PERMISSIONS.ANNOUNCEMENT_CREATE);

    const announcement = await tx.announcement.create({
      data: {
        title: data.title,
        content: data.content,
        authorId: user.id,
        isPinned: data.isPinned,
        isUrgent: data.isUrgent,
        targetType: data.targetType,
        targetIds: data.targetType === "ALL" ? [] : data.targetIds,
      },
    });

    if (recipientIds.length > 0) {
      await tx.notification.createMany({
        data: recipientIds.map((recipientId) => ({
          userId: recipientId,
          type: data.isUrgent ? "ANNOUNCEMENT_URGENT" : "ANNOUNCEMENT_NEW",
          title: data.title,
          content: data.content.slice(0, 240),
          relatedType: "ANNOUNCEMENT",
          relatedId: announcement.id,
        })),
        skipDuplicates: true,
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entityType: "Announcement",
        entityId: announcement.id,
        details: { targetType: data.targetType, recipientCount: recipientIds.length },
      },
    });

    return announcement;
  });

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
    return { ok: false, message: error instanceof Error ? error.message : "发布失败" };
  }
  redirect(ANNOUNCEMENT_LIST_ROUTE);
}
