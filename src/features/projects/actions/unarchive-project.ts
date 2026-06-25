"use server";

import { revalidatePath } from "next/cache";

import { assertProjectPermissionWithAudit } from "@/shared/lib/authorization";
import { getEffectiveTags, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

import { assertProjectCanUnarchive } from "../lib/archive";
import { hasEffectiveProjectLeadTag } from "../lib/tag-grants";

export async function unarchiveProject(projectId: string) {
  const user = await requireActiveUser();
  await assertProjectPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.PROJECT_MANAGE,
    projectId,
    entityType: "Project",
  });
  const effectiveTags = await getEffectiveTags(user.id);
  if (!hasEffectiveProjectLeadTag(effectiveTags, projectId)) {
    throw new Error("仅项目组长可以重新启用项目。");
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const current = await tx.project.findFirstOrThrow({
      where: { id: projectId, deletedAt: null },
      select: { status: true, archivedAt: true },
    });
    assertProjectCanUnarchive(current.status, current.archivedAt, now);

    const project = await tx.project.update({
      where: { id: projectId },
      data: { status: "IN_PROGRESS", archivedAt: null },
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "UPDATE",
        entityType: "Project",
        entityId: projectId,
        details: { status: "IN_PROGRESS" },
      },
    });

    return project;
  });
}

export async function unarchiveProjectFormAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  await unarchiveProject(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}
