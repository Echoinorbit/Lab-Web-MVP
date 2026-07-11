"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { appendAuditLog } from "@/shared/lib/audit";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { updateProjectNodeInputSchema } from "@/shared/lib/validators/projects";

import { ProjectNodeAuthorError, resolveProjectNodeAuthorAccess } from "../lib/node-author-ops";
import { assertProjectWritableStatus } from "../lib/writable";

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

      const row = await tx.projectNode.update({
        where: { id: node.id },
        data: {
          title: data.title,
          description: data.description,
          nodeType: data.nodeType,
        },
        select: { id: true, projectId: true, nodeType: true },
      });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot: createActorSnapshot(currentActor, now),
          action: "UPDATE",
          entityType: "ProjectNode",
          entityId: row.id,
          details: { projectId: row.projectId, nodeType: row.nodeType },
        },
      });
      return row;
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
      title: formData.get("title"),
      description: formData.get("description"),
      nodeType: formData.get("nodeType"),
    });
    projectId = node.projectId;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "更新失败" };
  }
  redirect(`/projects/${projectId}`);
}
