"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { RateLimitExceededError, enforceRateLimit } from "@/shared/lib/rate-limits";
import { requireActiveUser } from "@/shared/lib/session";
import { splitCommaList } from "@/shared/lib/utils";
import { publishPostInputSchema } from "@/shared/lib/validators/posts";

import { buildUserPostTagUpsertArgs, mergePostTagLabels } from "../lib/post-tags";
import { PostRateLimitError, formatPostRateLimitExceeded } from "../lib/rate-limit-copy";
import { saveDraft } from "./save-draft";

export async function createPost(input: unknown) {
  const user = await requireActiveUser();
  const data = publishPostInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.POST_CREATE,
    entityType: "Post",
  });

  let post: { id: string };
  try {
    post = await prisma.$transaction(async (tx) => {
      await enforceRateLimit(tx, user.id, PERMISSIONS.POST_CREATE);
      for (const tag of data.tags) {
        await tx.userPostTag.upsert(buildUserPostTagUpsertArgs(user.id, tag));
      }

      if (data.postId) {
        const draft = await tx.post.findFirst({
          where: {
            id: data.postId,
            authorId: user.id,
            status: "DRAFT",
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!draft) throw new Error("Draft not found.");

        const published = await tx.post.update({
          where: { id: data.postId },
          data: {
            title: data.title,
            content: data.content,
            category: data.category,
            tags: data.tags,
            status: "PUBLISHED",
          },
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "CREATE",
            entityType: "Post",
            entityId: published.id,
            details: { category: data.category, source: "draft" },
          },
        });

        return published;
      }

      const created = await tx.post.create({
        data: {
          title: data.title,
          content: data.content,
          category: data.category,
          tags: data.tags,
          authorId: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "CREATE",
          entityType: "Post",
          entityId: created.id,
          details: { category: data.category },
        },
      });

      return created;
    });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      throw new PostRateLimitError(formatPostRateLimitExceeded(error.result));
    }
    throw error;
  }

  revalidatePath("/posts");
  revalidatePath(`/posts/${post.id}`);
  return { id: post.id };
}

export type CreatePostFormState = {
  ok: boolean;
  message: string | null;
  draftId?: string;
  tone?: "error" | "info";
};

export async function createPostFormAction(
  _prevState: CreatePostFormState,
  formData: FormData,
): Promise<CreatePostFormState> {
  const draftPostId = String(formData.get("postId") ?? "").trim() || undefined;
  const selectedTags = formData.getAll("selectedTags").map(String);
  const newTags = splitCommaList(String(formData.get("newTags") ?? ""));
  const tags = mergePostTagLabels(selectedTags, newTags);
  const intent = String(formData.get("intent") ?? "publish");

  if (intent === "save-draft") {
    try {
      const draft = await saveDraft({
        postId: draftPostId,
        title: formData.get("title"),
        category: formData.get("category"),
        content: formData.get("content"),
        tags,
      });
      return { ok: true, message: "草稿已保存", draftId: draft.id };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "草稿保存失败",
        draftId: draftPostId,
      };
    }
  }

  let publishedPostId: string;
  try {
    const post = await createPost({
      postId: draftPostId,
      title: formData.get("title"),
      category: formData.get("category"),
      content: formData.get("content"),
      tags,
    });
    publishedPostId = post.id;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "保存失败",
      draftId: draftPostId,
      tone: error instanceof PostRateLimitError ? "info" : "error",
    };
  }
  // redirect() throws, so it must run outside the try/catch.
  redirect(`/posts/${publishedPostId}`);
}
