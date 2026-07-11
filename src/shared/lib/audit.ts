import type { AuditAction } from "@prisma/client";

import { loadActorSnapshot } from "./actor-snapshot";
import { prisma } from "./prisma";

export type AuditDetails = Record<string, string | number | boolean | null | string[]>;

export async function appendAuditLog(input: {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  details?: AuditDetails;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const actorSnapshot = input.userId ? await loadActorSnapshot(prisma, input.userId) : null;
  return prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      ...(actorSnapshot ? { actorSnapshot } : {}),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      details: input.details ?? undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export async function auditPermissionDenied(input: {
  userId?: string | null;
  permission: string;
  entityType: string;
  entityId?: string | null;
}) {
  await appendAuditLog({
    userId: input.userId,
    action: "PERMISSION_DENIED",
    entityType: input.entityType,
    entityId: input.entityId,
    details: { permission: input.permission },
  });
}
