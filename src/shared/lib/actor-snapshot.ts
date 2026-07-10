import type { Prisma, StudyDegree, UserStatus } from "@prisma/client";

export const ACTOR_SNAPSHOT_MAX_BYTES = 2048;
export const DELETED_ACTOR_NAME = "已删除用户";

export type ActorSnapshotV1 = {
  v: 1;
  displayName: string;
  studyDegree: StudyDegree | null;
  accountState: UserStatus | "DELETED";
  capturedAt: string;
};

type ActorSource = {
  displayName: string;
  studyDegree: StudyDegree | null;
  status: UserStatus;
};

function byteLength(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function createActorSnapshot(
  actor: ActorSource,
  capturedAt = new Date(),
  accountState: ActorSnapshotV1["accountState"] = actor.status,
): ActorSnapshotV1 {
  const snapshot: ActorSnapshotV1 = {
    v: 1,
    displayName: actor.displayName.trim().slice(0, 160) || DELETED_ACTOR_NAME,
    studyDegree: actor.studyDegree,
    accountState,
    capturedAt: capturedAt.toISOString(),
  };
  if (byteLength(snapshot) > ACTOR_SNAPSHOT_MAX_BYTES) throw new Error("用户署名快照超出大小限制。");
  return snapshot;
}

export function parseActorSnapshot(value: Prisma.JsonValue | null | undefined): ActorSnapshotV1 | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || byteLength(value) > ACTOR_SNAPSHOT_MAX_BYTES) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    record.v !== 1 ||
    typeof record.displayName !== "string" ||
    !record.displayName.trim() ||
    typeof record.capturedAt !== "string" ||
    Number.isNaN(Date.parse(record.capturedAt)) ||
    !["ACTIVE", "SUSPENDED", "GRADUATED", "DELETED"].includes(String(record.accountState)) ||
    ![null, "MASTER", "DOCTOR", "MENTOR"].includes(record.studyDegree as null | string)
  ) {
    return null;
  }
  return {
    v: 1,
    displayName: record.displayName.trim(),
    studyDegree: record.studyDegree as StudyDegree | null,
    accountState: record.accountState as ActorSnapshotV1["accountState"],
    capturedAt: record.capturedAt,
  };
}

export function resolveActorDisplay(
  live: { displayName: string; studyDegree?: StudyDegree | null; status?: UserStatus } | null | undefined,
  snapshot: Prisma.JsonValue | null | undefined,
) {
  if (live) {
    return {
      displayName: live.displayName,
      studyDegree: live.studyDegree ?? null,
      accountState: (live.status ?? "ACTIVE") as ActorSnapshotV1["accountState"],
      isDeleted: false,
    };
  }
  const parsed = parseActorSnapshot(snapshot);
  return {
    displayName: parsed?.displayName ?? DELETED_ACTOR_NAME,
    studyDegree: parsed?.studyDegree ?? null,
    accountState: parsed?.accountState ?? "DELETED",
    isDeleted: true,
  };
}
