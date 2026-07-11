import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { deleteUserAccount } from "@/features/admin/lib/delete-user-account";
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
  for (const candidate of candidates) {
    try {
      const result = await prisma.$transaction(
        (tx) => deleteUserAccount(tx, candidate.id, { kind: "scheduled" }),
        { timeout: 15_000 },
      );
      if (result.deleted) {
        deleted += 1;
        await removeManagedAvatar(result.avatar).catch(() => undefined);
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
  const orphanedAvatarsRemoved = await cleanupAvatarOrphans(referencedAvatars).catch(() => 0);

  return NextResponse.json({
    ok: failed === 0,
    processed: candidates.length,
    deleted,
    skipped,
    failed,
    orphanedAvatarsRemoved,
  }, { status: failed === 0 ? 200 : 207 });
}
