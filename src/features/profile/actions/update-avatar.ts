"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { toActionResult } from "@/shared/lib/action-result";
import {
  cleanupAvatarOrphans,
  decodeAvatarBase64,
  MAX_AVATAR_PNG_BYTES,
  removeManagedAvatar,
  storeAvatarPng,
} from "@/shared/lib/avatar-storage";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { getLockedActiveActor } from "@/shared/lib/user-lifecycle-lock";

const avatarInputSchema = z.object({
  pngBase64: z.string().min(1).max(Math.ceil(MAX_AVATAR_PNG_BYTES * 4 / 3) + 8),
});

const avatarFeedbackMessages = [
  "账号已失效，无法更新头像。",
  "头像数据编码无效。",
  "头像 PNG 必须小于 2 MiB。",
  "头像文件不是有效的 PNG。",
  "头像 PNG 结构异常。",
  "头像 PNG 数据块越界。",
  "头像 PNG 数据块类型无效。",
  "头像 PNG 校验失败。",
  "头像 PNG 缺少首部。",
  "头像 PNG 首部无效。",
  "头像必须是 512×512、8 位、非隔行 PNG。",
  "头像 PNG 图像数据顺序无效。",
  "头像 PNG 调色板顺序或长度无效。",
  "头像 PNG 结尾无效或包含尾随数据。",
  "头像 PNG 包含不支持的关键数据块。",
  "头像 PNG 不完整。",
  "头像 PNG 压缩数据无效或过大。",
  "头像 PNG 解码长度无效。",
  "头像 PNG 行过滤器无效。",
] as const;

export async function updateAvatar(input: unknown) {
  const actor = await requireActiveUser();
  const data = avatarInputSchema.parse(input);
  const bytes = decodeAvatarBase64(data.pngBase64);
  const nextAvatar = await storeAvatarPng(bytes);
  let previousAvatar: string | null = null;
  try {
    previousAvatar = await prisma.$transaction(async (tx) => {
      const currentActor = await getLockedActiveActor(tx, actor.id);
      if (!currentActor) throw new Error("账号已失效，无法更新头像。");
      const current = await tx.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { avatar: true },
      });
      await tx.user.update({ where: { id: actor.id }, data: { avatar: nextAvatar } });
      await tx.auditLog.create({
        data: {
          userId: actor.id,
          actorSnapshot: currentActor.actorSnapshot,
          action: "UPDATE",
          entityType: "UserAvatar",
          entityId: actor.id,
          details: { changed: true },
        },
      });
      return current.avatar;
    });
  } catch (error) {
    try {
      await removeManagedAvatar(nextAvatar);
    } catch {
      throw new Error("头像保存失败；未使用文件将在后台任务中重试清理。", { cause: error });
    }
    throw error;
  }

  let cleanupPending = false;
  if (previousAvatar !== nextAvatar) {
    try {
      await removeManagedAvatar(previousAvatar);
    } catch {
      cleanupPending = true;
    }
  }
  const referenced = new Set((await prisma.user.findMany({
    where: { avatar: { not: null } },
    select: { avatar: true },
  })).flatMap((user) => user.avatar ? [user.avatar] : []));
  try {
    await cleanupAvatarOrphans(referenced);
  } catch {
    cleanupPending = true;
  }

  revalidatePath("/");
  revalidatePath("/profile");
  return { avatar: nextAvatar, cleanupPending };
}

export async function updateAvatarResult(input: unknown) {
  return toActionResult(() => updateAvatar(input), {
    fallbackMessage: "头像保存失败，请稍后重试。",
    knownMessages: [...avatarFeedbackMessages, "头像保存失败；未使用文件将在后台任务中重试清理。"],
  });
}
