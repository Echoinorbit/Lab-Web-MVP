export function normalizeProjectMemberUserIds(leadUserId: string, memberUserIds: readonly string[]) {
  return [...new Set(memberUserIds)].filter((userId) => userId && userId !== leadUserId);
}

export function resolveProjectCreationAssignments({
  leadUserId,
  memberUserIds,
}: {
  creatorUserId: string;
  leadUserId: string;
  memberUserIds: readonly string[];
}) {
  return {
    leadUserId,
    memberUserIds: normalizeProjectMemberUserIds(leadUserId, memberUserIds),
  };
}
