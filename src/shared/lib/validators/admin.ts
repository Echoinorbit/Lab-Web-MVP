import { z } from "zod";

const studyDegreeSchema = z.enum(["MASTER", "DOCTOR", "MENTOR"]);
const studyGradeSchema = z.enum([
  "MASTER_0", "MASTER_1", "MASTER_2", "MASTER_3",
  "DOCTOR_1", "DOCTOR_2", "DOCTOR_3", "DOCTOR_4", "DOCTOR_5",
]);

function addStudyIdentityIssue(
  data: { studyDegree: z.infer<typeof studyDegreeSchema>; studyGrade?: z.infer<typeof studyGradeSchema> },
  context: z.RefinementCtx,
) {
  const grade = data.studyGrade;
  const valid = data.studyDegree === "MENTOR"
    ? !grade
    : data.studyDegree === "MASTER"
      ? grade?.startsWith("MASTER_")
      : grade?.startsWith("DOCTOR_");
  if (!valid) context.addIssue({ code: z.ZodIssueCode.custom, path: ["studyGrade"], message: "年级与培养身份不匹配。" });
}

export const createUserInputSchema = z.object({
  username: z.string().trim().min(2).max(80),
  displayName: z.string().trim().min(1).max(120),
  password: z.string().min(10).max(256),
  studentId: z.string().trim().max(80).optional(),
  studyDegree: studyDegreeSchema,
  studyGrade: studyGradeSchema.optional(),
  advisorId: z.string().min(1).optional(),
}).superRefine(addStudyIdentityIssue);

export const importUsersInputSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  base64: z.string().min(1).max(7_000_000),
});

export const confirmUserImportInputSchema = importUsersInputSchema.extend({
  previewToken: z.string().min(1).max(2048),
});

export const updateUserStatusInputSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "GRADUATED"]),
});

export const cancelUserGraduationInputSchema = z.object({
  userId: z.string().min(1),
});

export const deleteUserAccountInputSchema = z.object({
  userId: z.string().min(1),
  confirmUsername: z.string().trim().min(1).max(80),
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
  studyGrade: studyGradeSchema,
});

export const updateUserStudyIdentityInputSchema = z.object({
  userId: z.string().min(1),
  studyDegree: studyDegreeSchema,
  studyGrade: studyGradeSchema.optional(),
  confirmGraduatedRepair: z.boolean().optional(),
}).superRefine(addStudyIdentityIssue);

export const revokeUserSessionsInputSchema = z.object({
  userId: z.string().min(1),
});

export const updateSystemSettingsInputSchema = z.object({
  revision: z.number().int().min(0),
  progressStartDay: z.number().int().min(1).max(31),
  progressStartMinute: z.number().int().min(0).max(1439),
  progressEndDay: z.number().int().min(1).max(31),
  progressEndMinute: z.number().int().min(0).max(1439),
  sessionHours: z.number().int().min(1).max(720),
});
