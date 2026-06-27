"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

import { applyHardDeleteProject, type ProjectHardDeleteTransaction } from "../lib/hard-delete";

export async function softDeleteAdvisedProject(projectId: string) {
  const actor = await requireActiveUser();
  await assertPermissionWithAudit({
    userId: actor.id,
    permission: PERMISSIONS.PROJECT_DELETE_ADVISED,
    entityType: "Project",
    entityId: projectId,
  });

  const deletedAt = new Date();
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, advisorId: actor.id, deletedAt: null },
      select: { name: true, advisorId: true, status: true, archivedAt: true },
    });
    if (!project) throw new Error("仅负责导师可以软删除自己的项目。");
    const result = await tx.project.updateMany({
      where: { id: projectId, advisorId: actor.id, deletedAt: null },
      data: { deletedAt },
    });
    if (result.count !== 1) throw new Error("项目状态已变化，请刷新后重试。");
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "DELETE",
        entityType: "Project",
        entityId: projectId,
        details: { mode: "SOFT", deletedAt, before: project },
      },
    });
  });
}

export async function restoreProject(projectId: string) {
  const actor = await requireActiveUser();
  await assertPermissionWithAudit({
    userId: actor.id,
    permission: PERMISSIONS.PROJECT_RESTORE,
    entityType: "Project",
    entityId: projectId,
  });
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findFirst({
      where: { id: projectId, deletedAt: { not: null } },
      select: { name: true, deletedAt: true },
    });
    if (!project) throw new Error("项目不存在或未被软删除。");
    const result = await tx.project.updateMany({
      where: { id: projectId, deletedAt: { not: null } },
      data: { deletedAt: null },
    });
    if (result.count !== 1) throw new Error("项目状态已变化，请刷新后重试。");
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "UPDATE",
        entityType: "Project",
        entityId: projectId,
        details: { mode: "SOFT", before: project, restoredAt: new Date() },
      },
    });
  });
}

export async function hardDeleteProject(projectId: string) {
  const actor = await requireActiveUser();
  await assertPermissionWithAudit({
    userId: actor.id,
    permission: PERMISSIONS.PROJECT_DELETE_ANY,
    entityType: "Project",
    entityId: projectId,
  });

  return prisma.$transaction((tx) => applyHardDeleteProject(
    tx as unknown as ProjectHardDeleteTransaction,
    { projectId, actorId: actor.id },
  ));
}

export async function softDeleteProjectFormAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  await softDeleteAdvisedProject(projectId);
  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/projects");
}

export async function restoreProjectFormAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  await restoreProject(projectId);
  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

export async function hardDeleteProjectFormAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get("projectId") ?? "");
  await hardDeleteProject(projectId);
  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/projects");
}
