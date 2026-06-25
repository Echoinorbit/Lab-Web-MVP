"use server";

import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/shared/lib/audit";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { deleteProjectNodeInputSchema } from "@/shared/lib/validators/projects";

import { ProjectNodeAuthorError, resolveProjectNodeAuthorAccess } from "../lib/node-author-ops";
import { assertProjectWritable } from "../lib/writable";

export async function deleteProjectNode(input: unknown) {
  const actor = await requireActiveUser();
  const data = deleteProjectNodeInputSchema.parse(input);

  const node = await prisma.projectNode.findFirstOrThrow({
    where: { id: data.nodeId, deletedAt: null },
    select: { id: true, projectId: true, authorId: true },
  });
  await assertProjectWritable(node.projectId);

  const access = resolveProjectNodeAuthorAccess({ userId: actor.id, authorId: node.authorId });
  if (!access.allowed) {
    await appendAuditLog({
      userId: actor.id,
      action: "PERMISSION_DENIED",
      entityType: "ProjectNode",
      entityId: node.id,
      details: { projectId: node.projectId, reason: access.reason },
    });
    throw new ProjectNodeAuthorError();
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectNode.update({
      where: { id: node.id },
      data: { deletedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "DELETE",
        entityType: "ProjectNode",
        entityId: node.id,
        details: { projectId: node.projectId },
      },
    });
  });

  revalidatePath(`/projects/${node.projectId}`);
}

export type DeleteProjectNodeState = { ok: boolean; message: string | null };

export async function deleteProjectNodeFormAction(
  _prevState: DeleteProjectNodeState,
  formData: FormData,
): Promise<DeleteProjectNodeState> {
  try {
    await deleteProjectNode({ nodeId: formData.get("nodeId") });
    return { ok: true, message: "节点已删除" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "删除失败" };
  }
}
