import { PROJECT_LEAD_TAG_PREFIX, PROJECT_MEMBER_TAG_PREFIX } from "@/shared/lib/system-tags";

const manualProjectTagError = "项目组标签由项目流程自动管理，不能手动授予或撤销。";
const manualGraduatedTagError = "毕业状态由用户状态流程管理，不能手动授予或撤销毕业 Tag。";
const manualStudyIdentityTagError = "培养身份系统 Tag 由学位字段自动维护，不能手动授予或撤销。";
const STUDY_IDENTITY_TAG_NAMES = new Set(["grad-master", "grad-phd", "advisor"]);

type ManualTagTarget = {
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "SUSPENDED" | "GRADUATED";
};

export function isProjectManagedTagName(tagName: string) {
  return tagName.startsWith(`${PROJECT_LEAD_TAG_PREFIX}:`) || tagName.startsWith(`${PROJECT_MEMBER_TAG_PREFIX}:`);
}

export function isManuallyManageableTagName(tagName: string) {
  return !STUDY_IDENTITY_TAG_NAMES.has(tagName)
    && tagName !== "graduated"
    && !isProjectManagedTagName(tagName);
}

export function assertManuallyManageableTagName(tagName: string) {
  if (STUDY_IDENTITY_TAG_NAMES.has(tagName)) {
    throw new Error(manualStudyIdentityTagError);
  }
  if (tagName === "graduated") {
    throw new Error(manualGraduatedTagError);
  }
  if (isProjectManagedTagName(tagName)) {
    throw new Error(manualProjectTagError);
  }
}

export function assertManualTagTargetEligible(target: ManualTagTarget | null): asserts target is ManualTagTarget {
  if (!target) throw new Error("目标成员不存在。");
  if (target.role === "ADMIN") throw new Error("管理员是治理账号，不能被授予或撤销 Tag。");
  if (target.status !== "ACTIVE") throw new Error("仅可管理在用成员的 Tag。");
}
