import { z } from "zod";

export const progressReportInputSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  studySummary: z.string().max(20000).optional(),
  projectSummary: z.string().max(20000).optional(),
  thesisSummary: z.string().max(20000).optional(),
  otherWork: z.string().max(20000).optional(),
  externalDays: z.number().int().min(0).max(31).default(0),
});

export const progressBackfillInputSchema = z.object({
  userId: z.string().min(1),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
});
