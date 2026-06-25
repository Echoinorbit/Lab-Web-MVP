import { z } from "zod";

export const grantTagInputSchema = z.object({
  userId: z.string().min(1),
  tagId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  expiresAt: z.string().datetime().optional(),
});

export const revokeTagInputSchema = z.object({
  userTagId: z.string().min(1),
});
