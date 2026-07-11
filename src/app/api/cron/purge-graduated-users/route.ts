import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { deleteUserAccount, getPurgeResponseStatus } from "@/features/admin/lib/delete-user-account";
import { cleanupAvatarOrphans, removeManagedAvatar } from "@/shared/lib/avatar-storage";
import { isBearerSecretAuthorized } from "@/shared/lib/cron-auth";
import { prisma } from "@/shared/lib/prisma";

const PURGE_BATCH_SIZE = 50;

export async function POST(request: Request) {
  if (!isBearerSecretAuthorized({
    authorizationHeader: request.headers.get("authorization"),
    secret: process.env.CRON_SECRET,
  })) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const candidates = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "User"
    WHERE "status" = 'GRADUATED'
      AND "scheduledDeletionAt" IS NOT NULL
      AND "scheduledDeletionAt" <= transaction_timestamp()
    ORDER BY "scheduledDeletionAt", "id"
    LIMIT ${PURGE_BATCH_SIZE}
  `);

  let deleted = 0;
  let skipped = 0;
  let failed = 0;
  let avatarCleanupFailed = 0;
  for (const candidate of candidates) {
    try {
      const result = await prisma.$transaction(
        (tx) => deleteUserAccount(tx, candidate.id, { kind: "scheduled" }),
        { timeout: 15_000 },
      );
      if (result.deleted) {
        deleted += 1;
        try {
          await removeManagedAvatar(result.avatar);
        } catch {
          avatarCleanupFailed += 1;
        }
      } else {
        skipped += 1;
      }
    } catch {
      failed += 1;
    }
  }

  const referencedAvatars = new Set((await prisma.user.findMany({
    where: { avatar: { not: null } },
    select: { avatar: true },
  })).flatMap((user) => user.avatar ? [user.avatar] : []));
  let orphanedAvatarsRemoved = 0;
  try {
    orphanedAvatarsRemoved = await cleanupAvatarOrphans(referencedAvatars);
  } catch {
    avatarCleanupFailed += 1;
  }

  const status = getPurgeResponseStatus(failed, avatarCleanupFailed);

  return NextResponse.json({
    ok: status === 200,
    processed: candidates.length,
    deleted,
    skipped,
    failed,
    avatarCleanupFailed,
    orphanedAvatarsRemoved,
  }, { status });
}
