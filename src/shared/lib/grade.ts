import { getShanghaiDateParts } from "./date";

export type GradeTrack = "master" | "phd";

// master: 研0,研1,研2,研3 -> 第 4 个完整学年起为已毕业。
// phd: 博1,博2,博3,博4,博5 -> 第 5 个完整学年起为已毕业。
export const GRADE_LABELS = {
  master: ["研0", "研1", "研2", "研3"],
  phd: ["博1", "博2", "博3", "博4", "博5"],
} as const;

export type GradeLabel = (typeof GRADE_LABELS)[GradeTrack][number];

function shanghaiMidnightDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day - 1, 16, 0, 0, 0));
}

function academicYearStartYear(date: Date) {
  const parts = getShanghaiDateParts(date);
  return parts.month > 9 || (parts.month === 9 && parts.day >= 1) ? parts.year : parts.year - 1;
}

export function yearsSinceEnrollment(enrollment: Date, now = new Date()) {
  return Math.max(0, academicYearStartYear(now) - academicYearStartYear(enrollment));
}

export function computeGrade(track: GradeTrack, enrollment: Date, now = new Date()): string | null {
  return GRADE_LABELS[track][yearsSinceEnrollment(enrollment, now)] ?? null;
}

export function isGraduatedByGrade(track: GradeTrack, enrollment: Date, now = new Date()) {
  return computeGrade(track, enrollment, now) === null;
}

export function defaultEnrollmentDate(createdAt: Date) {
  return shanghaiMidnightDate(getShanghaiDateParts(createdAt).year, 9, 1);
}

export function enrollmentDateForGrade(track: GradeTrack, gradeLabel: string, now = new Date()) {
  const labelIndex = (GRADE_LABELS[track] as readonly string[]).indexOf(gradeLabel);
  if (labelIndex < 0) {
    throw new Error("年级标签与培养类型不匹配。");
  }
  return shanghaiMidnightDate(academicYearStartYear(now) - labelIndex, 9, 1);
}

export function resolveGradeTrackFromTagNames(tagNames: readonly string[]): GradeTrack | null {
  if (tagNames.includes("grad-phd")) return "phd";
  if (tagNames.includes("grad-master")) return "master";
  return null;
}

export function formatComputedGrade(
  user: {
    grade?: string | null;
    enrollmentDate?: Date | string | null;
    tagNames: readonly string[];
  },
  now = new Date(),
) {
  const track = resolveGradeTrackFromTagNames(user.tagNames);
  if (track && user.enrollmentDate) {
    return computeGrade(track, new Date(user.enrollmentDate), now) ?? "已毕业";
  }
  return user.grade?.trim() || "—";
}
