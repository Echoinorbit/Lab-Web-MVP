export const PROJECT_NODE_AUTHOR_ONLY_MESSAGE = "只有节点作者可以编辑或删除该节点。";

export type ProjectNodeAuthorAccess =
  | { allowed: true; scope: "author" }
  | { allowed: false; scope: "denied"; reason: "author_only" };

export function resolveProjectNodeAuthorAccess({
  userId,
  authorId,
}: {
  userId: string;
  authorId: string;
  isProjectLead?: boolean;
}): ProjectNodeAuthorAccess {
  if (userId === authorId) {
    return { allowed: true, scope: "author" };
  }
  return { allowed: false, scope: "denied", reason: "author_only" };
}

export class ProjectNodeAuthorError extends Error {
  constructor() {
    super(PROJECT_NODE_AUTHOR_ONLY_MESSAGE);
    this.name = "ProjectNodeAuthorError";
  }
}
