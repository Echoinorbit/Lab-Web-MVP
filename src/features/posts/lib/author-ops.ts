import { PERMISSIONS, type Permission } from "@/shared/lib/permissions";

export type AuthorAccess =
  | { allowed: true; scope: "own" | "any"; permission: Permission }
  | { allowed: false; scope: "denied"; permission: Permission };

type AccessInput = {
  userId: string;
  authorId: string;
  permissions: ReadonlySet<Permission>;
};

export function resolvePostUpdateAccess(input: AccessInput): AuthorAccess {
  if (input.userId === input.authorId && input.permissions.has(PERMISSIONS.POST_UPDATE_OWN)) {
    return { allowed: true, scope: "own", permission: PERMISSIONS.POST_UPDATE_OWN };
  }
  return { allowed: false, scope: "denied", permission: PERMISSIONS.POST_UPDATE_OWN };
}

export function resolvePostDeleteAccess(input: AccessInput): AuthorAccess {
  if (input.permissions.has(PERMISSIONS.POST_DELETE_ANY)) {
    return { allowed: true, scope: "any", permission: PERMISSIONS.POST_DELETE_ANY };
  }
  if (input.userId === input.authorId && input.permissions.has(PERMISSIONS.POST_DELETE_OWN)) {
    return { allowed: true, scope: "own", permission: PERMISSIONS.POST_DELETE_OWN };
  }
  return {
    allowed: false,
    scope: "denied",
    permission: input.userId === input.authorId ? PERMISSIONS.POST_DELETE_OWN : PERMISSIONS.POST_DELETE_ANY,
  };
}

export function resolveCommentDeleteAccess(input: AccessInput): AuthorAccess {
  if (input.permissions.has(PERMISSIONS.COMMENT_DELETE_ANY)) {
    return { allowed: true, scope: "any", permission: PERMISSIONS.COMMENT_DELETE_ANY };
  }
  if (input.userId === input.authorId && input.permissions.has(PERMISSIONS.COMMENT_DELETE_OWN)) {
    return { allowed: true, scope: "own", permission: PERMISSIONS.COMMENT_DELETE_OWN };
  }
  return {
    allowed: false,
    scope: "denied",
    permission: input.userId === input.authorId ? PERMISSIONS.COMMENT_DELETE_OWN : PERMISSIONS.COMMENT_DELETE_ANY,
  };
}
