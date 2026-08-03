import type { Prisma, UserStatus } from "@prisma/client";

import { formatActorDisplayName, resolveActorDisplay } from "@/shared/lib/actor-snapshot";
import { terminalActorSnapshot } from "@/shared/lib/audit";

export type AuditEntityIdentity = {
  displayName: string;
  username?: string;
};

type LiveAuditUser = {
  displayName: string;
  username: string;
  status: UserStatus;
};

export function resolveAuditUserEntity(input: {
  entityType: string;
  entityId?: string | null;
  liveUser?: LiveAuditUser | null;
  details?: Prisma.JsonValue | null;
}): AuditEntityIdentity | undefined {
  if (input.entityType !== "User" || !input.entityId) return undefined;

  if (input.liveUser) {
    return {
      displayName: formatActorDisplayName(resolveActorDisplay(input.liveUser, null)),
      username: input.liveUser.username,
    };
  }

  const snapshot = terminalActorSnapshot(input.details ?? null);
  return snapshot
    ? { displayName: formatActorDisplayName(resolveActorDisplay(null, snapshot)) }
    : undefined;
}
