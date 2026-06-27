import { PROJECT_LEAD_TAG_PREFIX, PROJECT_MEMBER_TAG_PREFIX } from "@/shared/lib/system-tags";

const manualProjectTagError = "项目组标签由项目流程自动管理，不能手动授予或撤销。";
const manualGraduatedTagError = "毕业状态由用户状态流程管理，不能手动授予或撤销毕业 Tag。";

export function isProjectManagedTagName(tagName: string) {
  return tagName.startsWith(`${PROJECT_LEAD_TAG_PREFIX}:`) || tagName.startsWith(`${PROJECT_MEMBER_TAG_PREFIX}:`);
}

export function assertManuallyManageableTagName(tagName: string) {
  if (tagName === "graduated") {
    throw new Error(manualGraduatedTagError);
  }
  if (isProjectManagedTagName(tagName)) {
    throw new Error(manualProjectTagError);
  }
}
