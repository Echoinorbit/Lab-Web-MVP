import { z } from "zod";

import { GRADE_LABELS } from "@/shared/lib/grade";

const userGradeOptions = [...GRADE_LABELS.master, ...GRADE_LABELS.phd] as [
  "研0",
  "研1",
  "研2",
  "研3",
  "博1",
  "博2",
  "博3",
  "博4",
  "博5",
];

export const createUserInputSchema = z.object({
  username: z.string().trim().min(2).max(80),
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(10).max(256),
  studentId: z.string().trim().max(80).optional(),
  grade: z.string().trim().max(40).optional(),
  advisorId: z.string().min(1).optional(),
});

export const importUsersInputSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  base64: z.string().min(1),
});

export const updateUserStatusInputSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "GRADUATED"]),
});

export const updateUserIdentityInputSchema = z.object({
  userId: z.string().min(1),
  username: z.string().trim().min(2).max(80),
  displayName: z.string().trim().min(1).max(120),
  studentId: z.string().trim().max(80).nullable().transform((value) => value || null),
});

export const updateUserRoleInputSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export const updateUserAdvisorInputSchema = z.object({
  userId: z.string().min(1),
  advisorId: z.string().min(1).optional().nullable(),
});

export const updateUserGradeInputSchema = z.object({
  userId: z.string().min(1),
  grade: z.enum(userGradeOptions),
});

export const revokeUserSessionsInputSchema = z.object({
  userId: z.string().min(1),
});
