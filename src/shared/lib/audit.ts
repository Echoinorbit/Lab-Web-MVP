import type { AuditAction, Prisma, PrismaClient } from "@prisma/client";

import { parseActorSnapshot } from "./actor-snapshot";
import { prisma } from "./prisma";
import { getLockedActor } from "./user-lifecycle-lock";

export type AuditDetails = Record<string, string | number | boolean | null | string[]>;

export function terminalActorSnapshot(details: Prisma.JsonValue | null) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const record = details as Prisma.JsonObject;
  if (![
    "ADMIN_PERMANENT_DELETE",
    "GRADUATION_GRACE_EXPIRED",
  ].includes(String(record.reason))) return null;
  const snapshot = parseActorSnapshot(record.target);
  return snapshot && (snapshot.accountState === "DELETED" || snapshot.accountState === "GRADUATED")
    ? snapshot
    : null;
}

export async function appendAuditLog(input: {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  details?: AuditDetails;
  ipAddress?: string | null;
  userAgent?: string | null;
}, client: PrismaClient = prisma) {
  const data = {
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    details: input.details ?? undefined,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  };
  const userId = input.userId;
  if (!userId) {
    return client.auditLog.create({ data: { userId: null, ...data } });
  }

  return client.$transaction(async (tx) => {
    const actor = await getLockedActor(tx, userId);
    const recoveredSnapshot = actor
      ? null
      : terminalActorSnapshot((await tx.auditLog.findFirst({
          where: { action: "DELETE", entityType: "User", entityId: userId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { details: true },
        }))?.details ?? null);
    const actorSnapshot = actor?.actorSnapshot ?? recoveredSnapshot;
    if (!actorSnapshot) {
      throw new Error("无法为不存在的用户保留审计归因。");
    }
    return tx.auditLog.create({
      data: {
        userId: actor ? userId : null,
        actorSnapshot,
        ...data,
      },
    });
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
