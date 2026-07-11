"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { toActionResult } from "@/shared/lib/action-result";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { getUserPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

import { applyHardDeleteProject, type ProjectHardDeleteTransaction } from "../lib/hard-delete";
import { canRestoreProjectSnapshot, canSoftDeleteProjectSnapshot } from "../lib/project-governance";

export async function softDeleteAdvisedProject(projectId: string) {
  const actor = await requireActiveUser();
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
      const [[{ now }], project, currentActor] = await Promise.all([
        tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
        tx.project.findUnique({
          where: { id: projectId },
          select: { name: true, advisorId: true, status: true, archivedAt: true, deletedAt: true },
        }),
        tx.user.findUnique({
          where: { id: actor.id },
          select: { role: true, status: true, displayName: true, studyDegree: true },
        }),
      ]);
      const permissions = await getUserPermissionsForClient(tx, actor.id, now);
      if (
        !currentActor
        || currentActor.status !== "ACTIVE"
        || !project
        || !canSoftDeleteProjectSnapshot(actor.id, project, permissions)
      ) {
        throw new PermissionDeniedError(PERMISSIONS.PROJECT_DELETE_ADVISED);
      }
      const result = await tx.project.updateMany({
        where: { id: projectId, advisorId: actor.id, deletedAt: null },
        data: { deletedAt: now },
      });
      if (result.count !== 1) throw new Error("项目状态已变化，请刷新后重试。");
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot: createActorSnapshot(currentActor, now),
          action: "DELETE",
          entityType: "Project",
          entityId: projectId,
          details: { mode: "SOFT", deletedAt: now, before: project },
        },
      });
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: actor.id,
        permission: error.permission,
        entityType: "Project",
        entityId: projectId,
      });
    }
    throw error;
  }
}

export async function restoreProject(projectId: string) {
  const actor = await requireActiveUser();
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
      const [[{ now }], project, currentActor] = await Promise.all([
        tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
        tx.project.findUnique({ where: { id: projectId }, select: { name: true, deletedAt: true } }),
        tx.user.findUnique({
          where: { id: actor.id },
          select: { role: true, status: true, displayName: true, studyDegree: true },
        }),
      ]);
      const permissions = await getUserPermissionsForClient(tx, actor.id, now);
      if (
        !currentActor
        || currentActor.status !== "ACTIVE"
        || !project
        || !canRestoreProjectSnapshot(project, permissions)
      ) {
        throw new PermissionDeniedError(PERMISSIONS.PROJECT_RESTORE);
      }
      const result = await tx.project.updateMany({
        where: { id: projectId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      if (result.count !== 1) throw new Error("项目状态已变化，请刷新后重试。");
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot: createActorSnapshot(currentActor, now),
          action: "UPDATE",
          entityType: "Project",
          entityId: projectId,
          details: { mode: "SOFT", before: project, restoredAt: now },
        },
      });
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: actor.id,
        permission: error.permission,
        entityType: "Project",
        entityId: projectId,
      });
    }
    throw error;
  }
}

export async function hardDeleteProject(projectId: string) {
  const actor = await requireActiveUser();
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${projectId} FOR UPDATE`;
      const [[{ now }], currentActor] = await Promise.all([
        tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
        tx.user.findUnique({
          where: { id: actor.id },
          select: { role: true, status: true, displayName: true, studyDegree: true },
        }),
      ]);
      const permissions = await getUserPermissionsForClient(tx, actor.id, now);
      if (!currentActor || currentActor.status !== "ACTIVE" || !permissions.has(PERMISSIONS.PROJECT_DELETE_ANY)) {
        throw new PermissionDeniedError(PERMISSIONS.PROJECT_DELETE_ANY);
      }
      return applyHardDeleteProject(
        tx as unknown as ProjectHardDeleteTransaction,
        { projectId, actorId: actor.id, actorSnapshot: createActorSnapshot(currentActor, now) },
      );
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: actor.id,
        permission: error.permission,
        entityType: "Project",
        entityId: projectId,
      });
    }
    throw error;
  }
}

const lifecycleFeedbackMessages = ["项目状态已变化，请刷新后重试。"] as const;

export async function softDeleteAdvisedProjectResult(projectId: string) {
  return toActionResult(async () => {
    await softDeleteAdvisedProject(projectId);
    return null;
  }, {
    fallbackMessage: "项目软删除失败，请稍后重试。",
    knownMessages: lifecycleFeedbackMessages,
  });
}

export async function restoreProjectResult(projectId: string) {
  return toActionResult(async () => {
    await restoreProject(projectId);
    return null;
  }, {
    fallbackMessage: "项目恢复失败，请稍后重试。",
    knownMessages: lifecycleFeedbackMessages,
  });
}

export async function hardDeleteProjectResult(projectId: string) {
  return toActionResult(async () => {
    await hardDeleteProject(projectId);
    return null;
  }, { fallbackMessage: "项目永久删除失败，请稍后重试。" });
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
