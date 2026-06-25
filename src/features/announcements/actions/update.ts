"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

const updateAnnouncementInputSchema = z.object({
  id: z.string().min(1),
  data: z.object({
    title: z.string().trim().min(2).max(160),
    content: z.string().trim().min(1).max(20000),
    isPinned: z.boolean().default(false),
    isUrgent: z.boolean().default(false),
  }),
});

export async function updateAnnouncement(input: unknown) {
  const user = await requireActiveUser();
  const parsed = updateAnnouncementInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.ANNOUNCEMENT_UPDATE,
    entityType: "Announcement",
    entityId: parsed.id,
  });

  await prisma.$transaction(async (tx) => {
    await tx.announcement.update({
      where: { id: parsed.id },
      data: parsed.data,
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        entityType: "Announcement",
        entityId: parsed.id,
      },
    });
  });

  revalidatePath("/announcements");
  revalidatePath(`/announcements/${parsed.id}`);
}
