"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActionErrorMessage } from "@/shared/lib/action-result";
import { appendAuditLog } from "@/shared/lib/audit";
import { getProjectPermissionsForClient, getUserPermissionsForClient } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";
import { updateProjectNodeInputSchema } from "@/shared/lib/validators/projects";

import { ProjectNodeManagerError, resolveProjectNodeManagerAccess } from "../lib/node-author-ops";
import {
  PROJECT_NODE_PARENT_INVALID_MESSAGE,
  assertProjectNodeParentAllowed,
  assertProjectNodeParentChainAllowed,
} from "../lib/node-parent-guard";
import { normalizeProjectNodeParentInput } from "../lib/node-parent-selection";
import { canManageProjectNodesSnapshot, isEligibleProjectLeaderActor } from "../lib/project-governance";
import { assertProjectWritableStatus } from "../lib/writable";

async function resolveUpdatedParentId(
  tx: Prisma.TransactionClient,
  projectId: string,
  nodeId: string,
  parentId: string | null | undefined,
) {
  if (parentId === undefined || parentId === null) return parentId;

  const nodes = await tx.projectNode.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, parentId: true },
  });
  const parentById = new Map(nodes.map((node) => [node.id, node.parentId]));
  assertProjectNodeParentAllowed(parentById.has(parentId) ? { id: parentId } : null);

  const parentChain: string[] = [];
  let cursor: string | null = parentId;
  while (cursor) {
    parentChain.push(cursor);
    cursor = parentById.get(cursor) ?? null;
  }
  assertProjectNodeParentChainAllowed(nodeId, parentChain);
  return parentId;
}

export async function updateProjectNode(input: unknown) {
  const actor = await requireActiveUser();
  const data = updateProjectNodeInputSchema.parse(input);

  const locatedNode = await prisma.projectNode.findFirstOrThrow({
    where: { id: data.nodeId, deletedAt: null },
    select: { id: true, projectId: true },
  });
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
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
      const parentId = await resolveUpdatedParentId(tx, locatedNode.projectId, node.id, data.parentId);

      const row = await tx.projectNode.update({
        where: { id: node.id },
        data: {
          title: data.title,
          description: data.description,
          nodeType: data.nodeType,
          ...(parentId === undefined ? {} : { parentId }),
        },
        select: { id: true, projectId: true, nodeType: true, parentId: true },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot: currentActor.actorSnapshot,
          action: "UPDATE",
          entityType: "ProjectNode",
          entityId: row.id,
          details: { projectId: row.projectId, nodeType: row.nodeType, parentId: row.parentId },
        },
      });
      return row;
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

  revalidatePath(`/projects/${updated.projectId}`);
  revalidatePath(`/projects/${updated.projectId}/nodes/${updated.id}/edit`);
  return updated;
}

export type UpdateProjectNodeState = { ok: boolean; message: string | null };

export async function updateProjectNodeFormAction(
  _prevState: UpdateProjectNodeState,
  formData: FormData,
): Promise<UpdateProjectNodeState> {
  let projectId: string;
  try {
    const node = await updateProjectNode({
      nodeId: formData.get("nodeId"),
      parentId: normalizeProjectNodeParentInput(formData.get("parentId")),
      title: formData.get("title"),
      description: formData.get("description"),
      nodeType: formData.get("nodeType"),
    });
    projectId = node.projectId;
  } catch (error) {
    return {
      ok: false,
      message: getActionErrorMessage(error, {
        fallbackMessage: "节点更新失败，请稍后重试。",
        knownMessages: [
          "只有节点作者、项目负责人或负责导师可以管理该节点。",
          "已归档项目不可写入。",
          PROJECT_NODE_PARENT_INVALID_MESSAGE,
        ],
      }),
    };
  }
  redirect(`/projects/${projectId}`);
}
