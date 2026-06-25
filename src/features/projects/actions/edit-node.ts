"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { appendAuditLog } from "@/shared/lib/audit";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { updateProjectNodeInputSchema } from "@/shared/lib/validators/projects";

import { ProjectNodeAuthorError, resolveProjectNodeAuthorAccess } from "../lib/node-author-ops";
import { assertProjectWritable } from "../lib/writable";

export async function updateProjectNode(input: unknown) {
  const actor = await requireActiveUser();
  const data = updateProjectNodeInputSchema.parse(input);

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

  const updated = await prisma.$transaction(async (tx) => {
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
        action: "UPDATE",
        entityType: "ProjectNode",
        entityId: row.id,
        details: { projectId: row.projectId, nodeType: row.nodeType },
      },
    });

    return row;
  });

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
