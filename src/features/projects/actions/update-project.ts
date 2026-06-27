"use server";

import { revalidatePath } from "next/cache";

import { assertProjectPermissionWithAudit } from "@/shared/lib/authorization";
import { getProjectPermissions, getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { updateProjectInputSchema } from "@/shared/lib/validators/projects";

import { canEditProjectSnapshot } from "../lib/project-governance";
import { projectScopedTagName } from "../lib/tag-grants";

export async function updateProject(input: unknown) {
  const actor = await requireActiveUser();
  const data = updateProjectInputSchema.parse(input);
  const project = await prisma.project.findFirstOrThrow({
    where: { id: data.projectId, deletedAt: null },
    select: { id: true, name: true, description: true, advisorId: true, deletedAt: true },
  });
  const [globalPermissions, projectPermissions] = await Promise.all([
    getUserPermissions(actor.id),
    getProjectPermissions(actor.id, data.projectId),
  ]);

  if (!canEditProjectSnapshot(actor.id, project, { globalPermissions, projectPermissions })) {
    await assertProjectPermissionWithAudit({
      userId: actor.id,
      permission: PERMISSIONS.PROJECT_MANAGE,
      projectId: data.projectId,
      entityType: "Project",
      entityId: data.projectId,
    });
    throw new Error("你无权编辑该项目。");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.project.findFirstOrThrow({
      where: { id: data.projectId, deletedAt: null },
      select: { name: true, description: true },
    });
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
    return { ok: false, message: error instanceof Error ? error.message : "更新失败" };
  }
}
