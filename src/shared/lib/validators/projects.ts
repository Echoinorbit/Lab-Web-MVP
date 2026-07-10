import { z } from "zod";

export const projectInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(20000).optional(),
  leadUserId: z.string().min(1),
  memberUserIds: z.array(z.string().min(1)).default([]),
  advisorId: z.string().min(1).optional(),
}).superRefine((value, context) => {
  if (!value.memberUserIds.includes(value.leadUserId)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["leadUserId"],
      message: "项目组长必须从已勾选的学生中指定。",
    });
  }
});

export const projectNodeInputSchema = z.object({
  projectId: z.string().min(1),
  parentId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().max(20000).optional(),
  nodeType: z.enum(["MILESTONE", "UPDATE", "DECISION", "ISSUE", "RESOURCE"]),
});

export const updateProjectNodeInputSchema = projectNodeInputSchema.omit({ projectId: true, parentId: true }).extend({
  nodeId: z.string().min(1),
});

export const deleteProjectNodeInputSchema = z.object({
  nodeId: z.string().min(1),
});

export const projectMembersInputSchema = z.object({
  projectId: z.string().min(1),
  userIds: z.array(z.string().min(1)).min(1).transform((values) => [...new Set(values)]),
});

export const updateProjectInputSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  description: z.string().max(20000).optional(),
});
