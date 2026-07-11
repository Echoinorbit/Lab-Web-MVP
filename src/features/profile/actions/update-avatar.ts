"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import {
  cleanupAvatarOrphans,
  decodeAvatarBase64,
  MAX_AVATAR_PNG_BYTES,
  removeManagedAvatar,
  storeAvatarPng,
} from "@/shared/lib/avatar-storage";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

const avatarInputSchema = z.object({
  pngBase64: z.string().min(1).max(Math.ceil(MAX_AVATAR_PNG_BYTES * 4 / 3) + 8),
});

export async function updateAvatar(input: unknown) {
  const actor = await requireActiveUser();
  const data = avatarInputSchema.parse(input);
  const bytes = decodeAvatarBase64(data.pngBase64);
  const nextAvatar = await storeAvatarPng(bytes);
  let previousAvatar: string | null = null;
  try {
    previousAvatar = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.id} FOR UPDATE`;
      const [current, [{ now }]] = await Promise.all([
        tx.user.findFirst({
          where: { id: actor.id },
          select: { avatar: true, displayName: true, studyDegree: true, status: true },
        }),
        tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
      ]);
      if (!current || current.status !== "ACTIVE") throw new Error("账号已失效，无法更新头像。");
      await tx.user.update({ where: { id: actor.id }, data: { avatar: nextAvatar } });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot: createActorSnapshot(current, now),
          action: "UPDATE",
          entityType: "UserAvatar",
          entityId: actor.id,
          details: { changed: true },
        },
      });
      return current.avatar;
    });
  } catch (error) {
    await removeManagedAvatar(nextAvatar).catch(() => undefined);
    throw error;
  }

  if (previousAvatar !== nextAvatar) await removeManagedAvatar(previousAvatar).catch(() => undefined);
  const referenced = new Set((await prisma.user.findMany({
    where: { avatar: { not: null } },
    select: { avatar: true },
  })).flatMap((user) => user.avatar ? [user.avatar] : []));
  await cleanupAvatarOrphans(referenced).catch(() => undefined);

  revalidatePath("/");
  revalidatePath("/profile");
  return { avatar: nextAvatar };
}
