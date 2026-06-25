export const PROJECT_NODE_PARENT_INVALID_MESSAGE = "父节点不存在或不属于当前项目。";

export type ProjectNodeParentLookupResult = { id: string } | null;

export function buildProjectNodeParentLookupWhere(parentId: string, projectId: string) {
  return {
    id: parentId,
    projectId,
    deletedAt: null,
  };
}

export function assertProjectNodeParentAllowed(parent: ProjectNodeParentLookupResult) {
  if (!parent) {
    throw new Error(PROJECT_NODE_PARENT_INVALID_MESSAGE);
  }
}
