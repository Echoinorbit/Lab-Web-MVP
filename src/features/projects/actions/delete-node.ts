"use server";

import { revalidatePath } from "next/cache";

import { toActionResult } from "@/shared/lib/action-result";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { appendAuditLog } from "@/shared/lib/audit";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { deleteProjectNodeInputSchema } from "@/shared/lib/validators/projects";

import { ProjectNodeAuthorError, resolveProjectNodeAuthorAccess } from "../lib/node-author-ops";
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
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${locatedNode.projectId} FOR UPDATE`;
      const [project, node, currentActor, [{ now }]] = await Promise.all([
        tx.project.findFirstOrThrow({
          where: { id: locatedNode.projectId, deletedAt: null },
          select: { status: true },
        }),
        tx.projectNode.findFirstOrThrow({
          where: { id: locatedNode.id, projectId: locatedNode.projectId, deletedAt: null },
          select: { id: true, authorId: true },
        }),
        tx.user.findFirst({
          where: { id: actor.id, status: "ACTIVE" },
          select: { displayName: true, studyDegree: true, status: true },
        }),
        tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
      ]);
      assertProjectWritableStatus(project.status);
      const access = resolveProjectNodeAuthorAccess({ userId: actor.id, authorId: node.authorId });
      if (!currentActor || !access.allowed) throw new ProjectNodeAuthorError();

      await tx.projectNode.update({
        where: { id: node.id },
        data: { deletedAt: now },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot: createActorSnapshot(currentActor, now),
          action: "DELETE",
          entityType: "ProjectNode",
          entityId: node.id,
          details: { projectId: locatedNode.projectId },
        },
      });
    });
  } catch (error) {
    if (error instanceof ProjectNodeAuthorError) {
      await appendAuditLog({
        userId: actor.id,
        action: "PERMISSION_DENIED",
        entityType: "ProjectNode",
        entityId: locatedNode.id,
        details: { projectId: locatedNode.projectId, reason: "author_only" },
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
    knownMessages: ["只有节点作者可以编辑或删除该节点。", "已归档项目不可写入。"],
  });
}
