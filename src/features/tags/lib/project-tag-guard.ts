import { PROJECT_LEAD_TAG_PREFIX, PROJECT_MEMBER_TAG_PREFIX } from "@/shared/lib/system-tags";

const manualProjectTagError = "项目组标签由项目流程自动管理，不能手动授予或撤销。";

export function isProjectManagedTagName(tagName: string) {
  return tagName.startsWith(`${PROJECT_LEAD_TAG_PREFIX}:`) || tagName.startsWith(`${PROJECT_MEMBER_TAG_PREFIX}:`);
}

export function assertManuallyManageableTagName(tagName: string) {
  if (isProjectManagedTagName(tagName)) {
    throw new Error(manualProjectTagError);
  }
}
