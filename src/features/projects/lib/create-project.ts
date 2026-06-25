export function normalizeProjectMemberUserIds(
  leadUserId: string,
  memberUserIds: readonly string[],
  excludedUserIds: readonly string[] = [],
) {
  const excluded = new Set([leadUserId, ...excludedUserIds]);
  return [...new Set(memberUserIds)].filter((userId) => userId && !excluded.has(userId));
}

export function resolveProjectCreationAssignments({
  leadUserId,
  memberUserIds,
  excludeCreatorFromLead = false,
  excludeCreatorFromMembers = false,
  creatorUserId,
}: {
  creatorUserId: string;
  leadUserId: string;
  memberUserIds: readonly string[];
  excludeCreatorFromLead?: boolean;
  excludeCreatorFromMembers?: boolean;
}) {
  if (excludeCreatorFromLead && leadUserId === creatorUserId) {
    throw new Error("导师创建项目时不能将自己设为项目组长。");
  }

  return {
    leadUserId,
    memberUserIds: normalizeProjectMemberUserIds(
      leadUserId,
      memberUserIds,
      excludeCreatorFromMembers ? [creatorUserId] : [],
    ),
  };
}
