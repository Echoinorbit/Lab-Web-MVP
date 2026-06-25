"use server";

import { revalidatePath } from "next/cache";

import { assertProjectPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { projectNodeInputSchema } from "@/shared/lib/validators/projects";

import { assertProjectWritable } from "../lib/writable";
import { assertProjectNodeParentAllowed, buildProjectNodeParentLookupWhere } from "../lib/node-parent-guard";

export async function createProjectNode(input: unknown) {
  const user = await requireActiveUser();
  const data = projectNodeInputSchema.parse(input);

  await assertProjectPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.PROJECT_NODE_CREATE,
    projectId: data.projectId,
    entityType: "ProjectNode",
  });
  await assertProjectWritable(data.projectId);

  const node = await prisma.$transaction(async (tx) => {
    if (data.parentId) {
      const parent = await tx.projectNode.findFirst({
        where: buildProjectNodeParentLookupWhere(data.parentId, data.projectId),
        select: { id: true },
      });
      assertProjectNodeParentAllowed(parent);
    }

    const created = await tx.projectNode.create({
      data: {
        projectId: data.projectId,
        parentId: data.parentId,
        title: data.title,
        description: data.description,
        nodeType: data.nodeType,
        authorId: user.id,
      },
    });

    const members = await tx.projectMember.findMany({
      where: { projectId: data.projectId, userId: { not: user.id } },
      select: { userId: true },
    });
    if (members.length > 0) {
      await tx.notification.createMany({
        data: members.map((member) => ({
          userId: member.userId,
          senderId: user.id,
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
        action: "CREATE",
        entityType: "ProjectNode",
        entityId: created.id,
        details: { projectId: data.projectId, nodeType: data.nodeType },
      },
    });

    return created;
  });

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
      parentId: formData.get("parentId") || undefined,
      title: formData.get("title"),
      description: formData.get("description"),
      nodeType: formData.get("nodeType"),
    });
    return { ok: true, message: "节点已创建" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "创建失败" };
  }
}
