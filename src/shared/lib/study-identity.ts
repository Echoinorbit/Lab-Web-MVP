import type { Role, StudyDegree, StudyGrade } from "@prisma/client";

export const STUDY_GRADES = {
  MASTER: ["MASTER_0", "MASTER_1", "MASTER_2", "MASTER_3"],
  DOCTOR: ["DOCTOR_1", "DOCTOR_2", "DOCTOR_3", "DOCTOR_4", "DOCTOR_5"],
  MENTOR: [],
} as const satisfies Record<StudyDegree, readonly StudyGrade[]>;

export const STUDY_GRADE_LABELS: Record<StudyGrade, string> = {
  MASTER_0: "研0",
  MASTER_1: "研1",
  MASTER_2: "研2",
  MASTER_3: "研3",
  DOCTOR_1: "博1",
  DOCTOR_2: "博2",
  DOCTOR_3: "博3",
  DOCTOR_4: "博4",
  DOCTOR_5: "博5",
};

const LEGACY_GRADE_MAP = new Map<string, { degree: StudyDegree; grade: StudyGrade }>([
  ["研0", { degree: "MASTER", grade: "MASTER_0" }],
  ["研1", { degree: "MASTER", grade: "MASTER_1" }],
  ["研2", { degree: "MASTER", grade: "MASTER_2" }],
  ["研3", { degree: "MASTER", grade: "MASTER_3" }],
  ["博1", { degree: "DOCTOR", grade: "DOCTOR_1" }],
  ["博2", { degree: "DOCTOR", grade: "DOCTOR_2" }],
  ["博3", { degree: "DOCTOR", grade: "DOCTOR_3" }],
  ["博4", { degree: "DOCTOR", grade: "DOCTOR_4" }],
  ["博5", { degree: "DOCTOR", grade: "DOCTOR_5" }],
]);

export function mapLegacyGrade(value: string | null | undefined) {
  return LEGACY_GRADE_MAP.get(value?.trim() ?? "") ?? null;
}

export function isStudyGradeForDegree(degree: StudyDegree, grade: StudyGrade | null) {
  if (degree === "MENTOR") return grade === null;
  return grade !== null && (STUDY_GRADES[degree] as readonly StudyGrade[]).includes(grade);
}

export function assertStudyIdentity(input: {
  role: Role;
  studyDegree: StudyDegree | null;
  studyGrade: StudyGrade | null;
}) {
  if (input.role === "ADMIN") {
    if (input.studyDegree !== null || input.studyGrade !== null) {
      throw new Error("管理员账号不能设置培养身份或年级。");
    }
    return;
  }

  if (!input.studyDegree) throw new Error("成员必须设置培养身份。");
  if (!isStudyGradeForDegree(input.studyDegree, input.studyGrade)) {
    throw new Error(input.studyDegree === "MENTOR" ? "导师不能设置年级。" : "年级与培养身份不匹配。");
  }
}

export function studyDegreeTagName(degree: StudyDegree) {
  if (degree === "MASTER") return "grad-master";
  if (degree === "DOCTOR") return "grad-phd";
  return "advisor";
}

export function formatStudyGrade(degree: StudyDegree | null, grade: StudyGrade | null) {
  if (degree === "MENTOR") return "导师";
  return grade ? STUDY_GRADE_LABELS[grade] : "待完善";
}
