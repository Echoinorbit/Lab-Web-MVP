"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { includeActiveAdminsInNotificationRecipients } from "@/features/notifications/lib/recipients";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { getProjectPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { projectNodeInputSchema } from "@/shared/lib/validators/projects";

import { assertProjectNodeParentAllowed, buildProjectNodeParentLookupWhere } from "../lib/node-parent-guard";
import { normalizeProjectNodeParentInput } from "../lib/node-parent-selection";
import { isEligibleProjectLeaderActor } from "../lib/project-governance";
import { assertProjectWritableStatus } from "../lib/writable";

async function resolveProjectNodeParentId(
  tx: Prisma.TransactionClient,
  projectId: string,
  parentId: string | null | undefined,
) {
  if (parentId === null) {
    return null;
  }

  if (parentId) {
    const parent = await tx.projectNode.findFirst({
      where: buildProjectNodeParentLookupWhere(parentId, projectId),
      select: { id: true },
    });
    assertProjectNodeParentAllowed(parent);
    return parentId;
  }

  const latestNode = await tx.projectNode.findFirst({
    where: { projectId, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  return latestNode?.id ?? null;
}

export async function createProjectNode(input: unknown) {
  const user = await requireActiveUser();
  const data = projectNodeInputSchema.parse(input);

  let node: { id: string; projectId: string };
  try {
    node = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${data.projectId} FOR UPDATE`;
      const [[{ now }], project, currentActor] = await Promise.all([
        tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
        tx.project.findFirstOrThrow({
          where: { id: data.projectId, deletedAt: null },
          select: { status: true, leaderId: true },
        }),
        tx.user.findUnique({
          where: { id: user.id },
          select: {
            role: true,
            status: true,
            displayName: true,
            studyDegree: true,
            identityNeedsReview: true,
          },
        }),
      ]);
      const projectPermissions = await getProjectPermissionsForClient(tx, user.id, data.projectId, now);
      const isCurrentLeader = currentActor
        ? isEligibleProjectLeaderActor(currentActor) && project.leaderId === user.id
        : false;
      if (
        !currentActor
        || currentActor.status !== "ACTIVE"
        || (!isCurrentLeader && !projectPermissions.has(PERMISSIONS.PROJECT_NODE_CREATE))
      ) {
        throw new PermissionDeniedError(PERMISSIONS.PROJECT_NODE_CREATE);
      }
      assertProjectWritableStatus(project.status);
      const parentId = await resolveProjectNodeParentId(tx, data.projectId, data.parentId);

      const created = await tx.projectNode.create({
        data: {
          projectId: data.projectId,
          parentId,
          title: data.title,
          description: data.description,
          nodeType: data.nodeType,
          authorId: user.id,
          authorSnapshot: createActorSnapshot(currentActor, now),
        },
      });

      const members = await tx.projectMember.findMany({
        where: { projectId: data.projectId, userId: { not: user.id } },
        select: { userId: true },
      });
      const recipientIds = await includeActiveAdminsInNotificationRecipients(tx, {
        recipientIds: members.flatMap((member) => member.userId ? [member.userId] : []),
        actorId: user.id,
      });
      if (recipientIds.length > 0) {
        await tx.notification.createMany({
          data: recipientIds.map((recipientId) => ({
            userId: recipientId,
            senderId: user.id,
            senderSnapshot: createActorSnapshot(currentActor, now),
            type: "PROJECT_NODE_NEW",
            title: "项目节点更新",
            content: data.title,
            relatedType: "PROJECT",
            relatedId: data.projectId,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          actorSnapshot: createActorSnapshot(currentActor, now),
          action: "CREATE",
          entityType: "ProjectNode",
          entityId: created.id,
          details: { projectId: data.projectId, nodeType: data.nodeType },
        },
      });

      return created;
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: user.id,
        permission: error.permission,
        entityType: "ProjectNode",
        entityId: data.projectId,
      });
    }
    throw error;
  }

  revalidatePath(`/projects/${data.projectId}`);
  return node;
}

export type ProjectNodeState = { ok: boolean; message: string | null };

export async function createProjectNodeFormAction(
  _prevState: ProjectNodeState,
  formData: FormData,
): Promise<ProjectNodeState> {
  try {
    await createProjectNode({
      projectId: formData.get("projectId"),
      parentId: normalizeProjectNodeParentInput(formData.get("parentId")),
      title: formData.get("title"),
      description: formData.get("description"),
      nodeType: formData.get("nodeType"),
    });
    return { ok: true, message: "节点已创建" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "创建失败" };
  }
}
