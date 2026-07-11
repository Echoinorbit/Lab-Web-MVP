import { z } from "zod";

export const announcementInputSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    content: z.string().trim().min(1).max(20000),
    isPinned: z.boolean().default(false),
    isUrgent: z.boolean().default(false),
    targetType: z.enum(["ALL", "PROJECT", "TAG", "USERS"]).default("ALL"),
    targetIds: z.array(z.string().min(1)).default([]),
  })
  .superRefine((value, context) => {
    if (value.targetType === "ALL" && value.targetIds.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetIds"],
        message: "All-user announcements must not include target ids.",
      });
    }
    if (value.targetType !== "ALL" && value.targetIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetIds"],
        message: "Targeted announcements require at least one target id.",
      });
    }
  });

export const updateAnnouncementInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  content: z.string().trim().min(1).max(20000),
  isPinned: z.boolean().default(false),
  isUrgent: z.boolean().default(false),
});
