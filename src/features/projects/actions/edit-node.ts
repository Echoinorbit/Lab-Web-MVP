"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getActionErrorMessage } from "@/shared/lib/action-result";
import { appendAuditLog } from "@/shared/lib/audit";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";
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
      const currentActor = await getLockedActiveActor(tx, actor.id);
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${locatedNode.projectId} FOR UPDATE`;
      const [project, node] = await Promise.all([
        tx.project.findFirstOrThrow({
          where: { id: locatedNode.projectId, deletedAt: null },
          select: { status: true },
        }),
        tx.projectNode.findFirstOrThrow({
          where: { id: locatedNode.id, projectId: locatedNode.projectId, deletedAt: null },
          select: { id: true, authorId: true },
        }),
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
          actorSnapshot: currentActor.actorSnapshot,
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
    return {
      ok: false,
      message: getActionErrorMessage(error, {
        fallbackMessage: "节点更新失败，请稍后重试。",
        knownMessages: ["只有节点作者可以编辑或删除该节点。", "已归档项目不可写入。"],
      }),
    };
  }
  redirect(`/projects/${projectId}`);
}
