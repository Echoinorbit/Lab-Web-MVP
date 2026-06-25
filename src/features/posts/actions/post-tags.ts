"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

import {
  buildUserPostTagDeleteWhere,
  buildUserPostTagListArgs,
  buildUserPostTagUpsertArgs,
} from "../lib/post-tags";

export async function listMyPostTags() {
  const user = await requireActiveUser();
  return prisma.userPostTag.findMany(buildUserPostTagListArgs(user.id));
}

export async function createMyPostTag(label: string) {
  const user = await requireActiveUser();
  const tag = await prisma.userPostTag.upsert(buildUserPostTagUpsertArgs(user.id, label));
  revalidatePath("/posts");
  return tag;
}

export async function deleteMyPostTag(id: string) {
  const user = await requireActiveUser();
  await prisma.userPostTag.deleteMany({ where: buildUserPostTagDeleteWhere(user.id, id) });
  revalidatePath("/posts");
}
