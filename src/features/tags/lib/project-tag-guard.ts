import { PROJECT_LEAD_TAG_PREFIX, PROJECT_MEMBER_TAG_PREFIX } from "@/shared/lib/system-tags";

const manualProjectTagError = "项目组标签由项目流程自动管理，不能手动授予或撤销。";
const manualGraduatedTagError = "毕业状态由用户状态流程管理，不能手动授予或撤销毕业 Tag。";
const manualStudyIdentityTagError = "培养身份系统 Tag 由学位字段自动维护，不能手动授予或撤销。";
const STUDY_IDENTITY_TAG_NAMES = new Set(["grad-master", "grad-phd", "advisor"]);

export function isProjectManagedTagName(tagName: string) {
  return tagName.startsWith(`${PROJECT_LEAD_TAG_PREFIX}:`) || tagName.startsWith(`${PROJECT_MEMBER_TAG_PREFIX}:`);
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
