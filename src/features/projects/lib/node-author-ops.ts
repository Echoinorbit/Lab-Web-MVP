export const PROJECT_NODE_MANAGER_ONLY_MESSAGE = "只有节点作者、项目负责人或负责导师可以管理该节点。";

export type ProjectNodeManagerAccess =
  | { allowed: true; scope: "author" | "project_manager" }
  | { allowed: false; scope: "denied"; reason: "node_manager_only" };

export function resolveProjectNodeManagerAccess({
  userId,
  authorId,
  canManageProjectNodes,
}: {
  userId: string;
  authorId: string | null;
  canManageProjectNodes: boolean;
}): ProjectNodeManagerAccess {
  if (userId === authorId) return { allowed: true, scope: "author" };
  if (canManageProjectNodes) return { allowed: true, scope: "project_manager" };
  return { allowed: false, scope: "denied", reason: "node_manager_only" };
}

export class ProjectNodeManagerError extends Error {
  constructor() {
    super(PROJECT_NODE_MANAGER_ONLY_MESSAGE);
    this.name = "ProjectNodeManagerError";
  }
}
