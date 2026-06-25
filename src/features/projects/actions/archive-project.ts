"use server";

import { revalidatePath } from "next/cache";

import { assertProjectPermissionWithAudit } from "@/shared/lib/authorization";
import { getEffectiveTags, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

import { assertProjectCanArchiveStatus } from "../lib/archive";
import { hasEffectiveProjectLeadTag } from "../lib/tag-grants";

export async function archiveProject(projectId: string) {
  const user = await requireActiveUser();
  await assertProjectPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.PROJECT_MANAGE,
    projectId,
    entityType: "Project",
  });
  const effectiveTags = await getEffectiveTags(user.id);
  if (!hasEffectiveProjectLeadTag(effectiveTags, projectId)) {
    throw new Error("仅项目组长可以归档项目。");
  }

  const archivedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const current = await tx.project.findFirstOrThrow({
      where: { id: projectId, deletedAt: null },
      select: { status: true },
    });
    assertProjectCanArchiveStatus(current.status);

    const project = await tx.project.update({
      where: { id: projectId },
      data: {
        status: "ARCHIVED",
        archivedAt,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        entityType: "Project",
        entityId: projectId,
        details: { status: "ARCHIVED" },
      },
    });

    return project;
  });
}

export async function archiveProjectFormAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  await archiveProject(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}
