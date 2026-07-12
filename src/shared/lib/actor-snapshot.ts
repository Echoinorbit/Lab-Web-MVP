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

type ActorLookupClient = Pick<Prisma.TransactionClient, "user">;

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

export async function loadActorSnapshot(
  client: ActorLookupClient,
  userId: string,
  capturedAt = new Date(),
) {
  const actor = await client.user.findUnique({
    where: { id: userId },
    select: { displayName: true, studyDegree: true, status: true },
  });
  return actor ? createActorSnapshot(actor, capturedAt) : null;
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

export function getActorDisplayAccountState(actor: ReturnType<typeof resolveActorDisplay>) {
  return actor.isDeleted && actor.accountState === "ACTIVE"
    ? "DELETED"
    : actor.accountState;
}

export function formatActorDisplayName(actor: ReturnType<typeof resolveActorDisplay>) {
  const accountState = getActorDisplayAccountState(actor);
  const suffix = accountState === "GRADUATED"
    ? "（已毕业）"
    : accountState === "DELETED"
      ? "（账号已删除）"
      : accountState === "SUSPENDED"
        ? "（已停用）"
        : "";
  return `${actor.displayName}${suffix}`;
}
