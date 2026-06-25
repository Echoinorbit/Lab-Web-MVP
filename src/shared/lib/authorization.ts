import { redirect } from "next/navigation";

import { FORBIDDEN_ROUTE, isPermissionDeniedError } from "./access-denied";
import { auditPermissionDenied } from "./audit";
import {
  assertPermission,
  assertProjectPermission,
  type Permission,
  PermissionDeniedError,
} from "./permissions";
import { requireActiveUser } from "./session";

export async function assertPermissionWithAudit(input: {
  userId: string;
  permission: Permission;
  entityType: string;
  entityId?: string | null;
}) {
  try {
    await assertPermission(input.userId, input.permission);
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: input.userId,
        permission: input.permission,
        entityType: input.entityType,
        entityId: input.entityId,
      });
    }
    throw error;
  }
}

export async function assertProjectPermissionWithAudit(input: {
  userId: string;
  permission: Permission;
  projectId: string;
  entityType: string;
  entityId?: string | null;
}) {
  try {
    await assertProjectPermission(input.userId, input.permission, input.projectId);
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: input.userId,
        permission: input.permission,
        entityType: input.entityType,
        entityId: input.entityId ?? input.projectId,
      });
    }
    throw error;
  }
}

export async function requirePermission(input: {
  permission: Permission;
  entityType: string;
  entityId?: string | null;
}) {
  const user = await requireActiveUser();
  try {
    await assertPermissionWithAudit({
      userId: user.id,
      permission: input.permission,
      entityType: input.entityType,
      entityId: input.entityId,
    });
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      redirect(FORBIDDEN_ROUTE);
    }
    throw error;
  }
  return user;
}
