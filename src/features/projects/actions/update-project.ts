"use server";

import { revalidatePath } from "next/cache";

import { getActionErrorMessage } from "@/shared/lib/action-result";
import { auditPermissionDenied } from "@/shared/lib/audit";
import {
  getProjectPermissionsForClient,
  getUserPermissionsForClient,
  PERMISSIONS,
  PermissionDeniedError,
} from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";
import { updateProjectInputSchema } from "@/shared/lib/validators/projects";

import { canEditProjectSnapshot, isEligibleProjectLeaderActor } from "../lib/project-governance";
import { projectScopedTagName } from "../lib/tag-grants";
import { assertProjectWritableStatus } from "../lib/writable";

export async function updateProject(input: unknown) {
  const actor = await requireActiveUser();
  const data = updateProjectInputSchema.parse(input);
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      const currentActor = await getLockedActiveActor(tx, actor.id);
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${data.projectId} FOR UPDATE`;
      const current = await tx.project.findFirstOrThrow({
        where: { id: data.projectId, deletedAt: null },
        select: {
          name: true,
          description: true,
          status: true,
          advisorId: true,
          leaderId: true,
          deletedAt: true,
        },
      });
      const [globalPermissions, projectPermissions] = await Promise.all([
        getUserPermissionsForClient(tx, actor.id, currentActor?.now),
        getProjectPermissionsForClient(tx, actor.id, data.projectId, currentActor?.now),
      ]);
      if (
        !currentActor
        || !canEditProjectSnapshot(
          actor.id,
          isEligibleProjectLeaderActor(currentActor.actor),
          current,
          { globalPermissions, projectPermissions },
        )
      ) {
        throw new PermissionDeniedError(PERMISSIONS.PROJECT_MANAGE);
      }
      assertProjectWritableStatus(current.status);
      const result = await tx.project.update({
        where: { id: data.projectId },
        data: { name: data.name, description: data.description || null },
      });
      await Promise.all([
        tx.tag.updateMany({
          where: { name: projectScopedTagName("lead", data.projectId) },
          data: { displayName: `${data.name} - 项目组长` },
        }),
        tx.tag.updateMany({
          where: { name: projectScopedTagName("member", data.projectId) },
          data: { displayName: `${data.name} - 项目成员` },
        }),
      ]);
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot: currentActor.actorSnapshot,
          action: "UPDATE",
          entityType: "Project",
          entityId: data.projectId,
          details: {
            before: current,
            after: { name: result.name, description: result.description },
          },
        },
      });
      return result;
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: actor.id,
        permission: error.permission,
        entityType: "Project",
        entityId: data.projectId,
      });
    }
    throw error;
  }
  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
  return updated;
}

export type UpdateProjectState = { ok: boolean; message: string | null };

export async function updateProjectFormAction(
  _previous: UpdateProjectState,
  formData: FormData,
): Promise<UpdateProjectState> {
  try {
    await updateProject({
      projectId: formData.get("projectId"),
      name: formData.get("name"),
      description: formData.get("description"),
    });
    return { ok: true, message: "项目信息已更新" };
  } catch (error) {
    return {
      ok: false,
      message: getActionErrorMessage(error, {
        fallbackMessage: "项目信息更新失败，请稍后重试。",
        knownMessages: ["已归档项目不可写入。"],
      }),
    };
  }
}
