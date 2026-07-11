import type { ActorSnapshotV1 } from "@/shared/lib/actor-snapshot";

import { projectScopedTagName } from "./tag-grants";

export type ProjectHardDeleteTransaction = {
  project: {
    findUniqueOrThrow(args: unknown): Promise<{ id: string; name: string; deletedAt: Date | null }>;
    delete(args: unknown): Promise<unknown>;
  };
  projectNode: { updateMany(args: unknown): Promise<unknown> };
  notification: { deleteMany(args: unknown): Promise<unknown> };
  tag: { deleteMany(args: unknown): Promise<unknown> };
  auditLog: { create(args: unknown): Promise<unknown> };
};

export async function applyHardDeleteProject(
  tx: ProjectHardDeleteTransaction,
  {
    projectId,
    actorId,
    actorSnapshot,
  }: { projectId: string; actorId: string; actorSnapshot: ActorSnapshotV1 },
) {
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { id: true, name: true, deletedAt: true },
  });
  // ProjectNode.parentId uses onDelete: Restrict; detach the self-referencing tree first.
  await tx.projectNode.updateMany({ where: { projectId }, data: { parentId: null } });
  await tx.notification.deleteMany({ where: { relatedType: "PROJECT", relatedId: projectId } });
  await tx.tag.deleteMany({
    where: {
      name: { in: [projectScopedTagName("lead", projectId), projectScopedTagName("member", projectId)] },
    },
  });
  await tx.project.delete({ where: { id: projectId } });
  await tx.auditLog.create({
    data: {
      userId: actorId,
      actorSnapshot,
      action: "DELETE",
      entityType: "Project",
      entityId: projectId,
      details: { mode: "HARD", name: project.name, wasSoftDeleted: Boolean(project.deletedAt) },
    },
  });
}
