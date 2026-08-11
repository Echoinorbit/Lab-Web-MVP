"use server";

import { revalidatePath } from "next/cache";

import { toActionResult } from "@/shared/lib/action-result";
import { appendAuditLog } from "@/shared/lib/audit";
import { getProjectPermissionsForClient, getUserPermissionsForClient } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";
import { deleteProjectNodeInputSchema } from "@/shared/lib/validators/projects";

import { ProjectNodeManagerError, resolveProjectNodeManagerAccess } from "../lib/node-author-ops";
import { canManageProjectNodesSnapshot, isEligibleProjectLeaderActor } from "../lib/project-governance";
import { assertProjectWritableStatus } from "../lib/writable";

export async function deleteProjectNode(input: unknown) {
  const actor = await requireActiveUser();
  const data = deleteProjectNodeInputSchema.parse(input);

  const locatedNode = await prisma.projectNode.findFirstOrThrow({
    where: { id: data.nodeId, deletedAt: null },
    select: { id: true, projectId: true },
  });
  try {
    await prisma.$transaction(async (tx) => {
      const currentActor = await getLockedActiveActor(tx, actor.id);
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${locatedNode.projectId} FOR UPDATE`;
      const [project, node] = await Promise.all([
        tx.project.findFirstOrThrow({
          where: { id: locatedNode.projectId, deletedAt: null },
          select: { status: true, advisorId: true, leaderId: true },
        }),
        tx.projectNode.findFirstOrThrow({
          where: { id: locatedNode.id, projectId: locatedNode.projectId, deletedAt: null },
          select: { id: true, authorId: true },
        }),
      ]);
      assertProjectWritableStatus(project.status);
      const [projectPermissions, globalPermissions] = await Promise.all([
        getProjectPermissionsForClient(tx, actor.id, locatedNode.projectId, currentActor?.now),
        getUserPermissionsForClient(tx, actor.id, currentActor?.now),
      ]);
      const isCurrentLeader = currentActor
        ? project.leaderId === actor.id && isEligibleProjectLeaderActor(currentActor.actor)
        : false;
      const access = resolveProjectNodeManagerAccess({
        userId: actor.id,
        authorId: node.authorId,
        canManageProjectNodes: canManageProjectNodesSnapshot(actor.id, isCurrentLeader, project, {
          projectPermissions,
          globalPermissions,
        }),
      });
      if (!currentActor || !access.allowed) throw new ProjectNodeManagerError();

      await tx.projectNode.update({
        where: { id: node.id },
        data: { deletedAt: currentActor.now },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot: currentActor.actorSnapshot,
          action: "DELETE",
          entityType: "ProjectNode",
          entityId: node.id,
          details: { projectId: locatedNode.projectId },
        },
      });
    });
  } catch (error) {
    if (error instanceof ProjectNodeManagerError) {
      await appendAuditLog({
        userId: actor.id,
        action: "PERMISSION_DENIED",
        entityType: "ProjectNode",
        entityId: locatedNode.id,
        details: { projectId: locatedNode.projectId, reason: "node_manager_only" },
      });
    }
    throw error;
  }

  revalidatePath(`/projects/${locatedNode.projectId}`);
}

export async function deleteProjectNodeResult(input: unknown) {
  return toActionResult(async () => {
    await deleteProjectNode(input);
    return null;
  }, {
    fallbackMessage: "项目节点删除失败，请稍后重试。",
    knownMessages: ["只有节点作者、项目负责人或负责导师可以管理该节点。", "已归档项目不可写入。"],
  });
}
