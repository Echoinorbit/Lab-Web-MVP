import { z } from "zod";

export const postInputSchema = z.object({
  title: z.string().trim().min(2).max(160),
  content: z.string().trim().min(1).max(20000),
  category: z.enum(["GENERAL", "EXPERIENCE", "TUTORIAL", "DISCUSSION", "RESOURCE"]).default("GENERAL"),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
});

export const publishPostInputSchema = postInputSchema.extend({
  postId: z.string().min(1).optional(),
});

export const draftInputSchema = z
  .object({
    postId: z.string().min(1).optional(),
    title: z.string().trim().max(160).default(""),
    content: z.string().trim().max(20000).default(""),
    category: z.enum(["GENERAL", "EXPERIENCE", "TUTORIAL", "DISCUSSION", "RESOURCE"]).default("GENERAL"),
    tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  })
  .refine((data) => data.title.length > 0 || data.content.length > 0, {
    message: "草稿至少需要标题或正文。",
    path: ["content"],
  });

export const commentInputSchema = z.object({
  postId: z.string().min(1),
  parentId: z.string().min(1).optional(),
  content: z.string().trim().min(1).max(5000),
});

export const deletePostInputSchema = z.object({
  postId: z.string().min(1),
});

export const updatePostInputSchema = postInputSchema.extend({
  postId: z.string().min(1),
});

export const deleteCommentInputSchema = z.object({
  commentId: z.string().min(1),
});
