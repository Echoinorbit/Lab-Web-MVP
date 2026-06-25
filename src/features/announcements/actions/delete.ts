"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

const deleteAnnouncementInputSchema = z.object({
  id: z.string().min(1),
});

export async function deleteAnnouncement(input: unknown) {
  const user = await requireActiveUser();
  const data = deleteAnnouncementInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.ANNOUNCEMENT_DELETE,
    entityType: "Announcement",
    entityId: data.id,
  });

  await prisma.$transaction(async (tx) => {
    await tx.announcement.update({
      where: { id: data.id },
      data: { deletedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "DELETE",
        entityType: "Announcement",
        entityId: data.id,
      },
    });
  });

  revalidatePath("/announcements");
}

export async function deleteAnnouncementFormAction(formData: FormData): Promise<void> {
  await deleteAnnouncement({ id: formData.get("id") });
}
