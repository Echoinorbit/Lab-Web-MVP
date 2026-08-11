import { PERMISSIONS, type Permission, type RoleName } from "@/shared/lib/permissions";

type ProjectGovernanceSnapshot = {
  advisorId?: string | null;
  leaderId?: string | null;
  deletedAt?: Date | string | null;
};

export function canManageProjectLeaderReassignment(
  actorId: string,
  actorRole: RoleName,
  project: ProjectGovernanceSnapshot,
  globalPermissions: ReadonlySet<Permission>,
) {
  if (project.deletedAt) return false;
  return actorRole === "ADMIN"
    || (project.advisorId === actorId && globalPermissions.has(PERMISSIONS.PROJECT_UPDATE_ADVISED));
}

export function isEligibleProjectLeaderActor(input: {
  role: RoleName;
  status: "ACTIVE" | "SUSPENDED" | "GRADUATED";
  studyDegree: "MASTER" | "DOCTOR" | "MENTOR" | null;
  identityNeedsReview: boolean;
}) {
  return input.role === "MEMBER"
    && input.status === "ACTIVE"
    && !input.identityNeedsReview
    && (input.studyDegree === "MASTER" || input.studyDegree === "DOCTOR");
}

export function resolveProjectCreationContext({
  actorId,
  actorRole,
  actorIsAdvisor,
  selectedAdvisorId,
}: {
  actorId: string;
  actorRole: RoleName;
  actorIsAdvisor: boolean;
  selectedAdvisorId?: string;
}) {
  if (actorRole === "ADMIN") {
    if (!selectedAdvisorId) throw new Error("管理员代建项目时必须选择负责导师。");
    return { creatorId: selectedAdvisorId, advisorId: selectedAdvisorId, delegated: true } as const;
  }
  if (!actorIsAdvisor) throw new Error("仅导师或管理员可以创建项目。");
  return { creatorId: actorId, advisorId: actorId, delegated: false } as const;
}

export function assertParticipantsBelongToAdvisor(
  advisorId: string,
  participantIds: readonly string[],
  candidates: readonly { id: string; advisorId: string | null }[],
) {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const invalid = [...new Set(participantIds)].some((id) => candidateById.get(id)?.advisorId !== advisorId);
  if (invalid) throw new Error("项目组长和成员必须是所选导师的直属在读学生。");
}

export function canEditProjectSnapshot(
  actorId: string,
  actorCanLead: boolean,
  project: ProjectGovernanceSnapshot,
  {
    projectPermissions,
    globalPermissions,
  }: {
    projectPermissions: ReadonlySet<Permission>;
    globalPermissions: ReadonlySet<Permission>;
  },
) {
  return canManageProjectNodesSnapshot(actorId, actorCanLead, project, { projectPermissions, globalPermissions });
}

export function canManageProjectNodesSnapshot(
  actorId: string,
  actorCanLead: boolean,
  project: ProjectGovernanceSnapshot,
  {
    projectPermissions,
    globalPermissions,
  }: {
    projectPermissions: ReadonlySet<Permission>;
    globalPermissions: ReadonlySet<Permission>;
  },
) {
  if (project.deletedAt) return false;
  return (actorCanLead && project.leaderId === actorId)
    || projectPermissions.has(PERMISSIONS.PROJECT_MANAGE)
    || (project.advisorId === actorId && globalPermissions.has(PERMISSIONS.PROJECT_UPDATE_ADVISED));
}

export function canSoftDeleteProjectSnapshot(
  actorId: string,
  project: ProjectGovernanceSnapshot,
  permissions: ReadonlySet<Permission>,
) {
  return !project.deletedAt
    && project.advisorId === actorId
    && permissions.has(PERMISSIONS.PROJECT_DELETE_ADVISED);
}

export function canRestoreProjectSnapshot(
  project: ProjectGovernanceSnapshot,
  permissions: ReadonlySet<Permission>,
) {
  return Boolean(project.deletedAt) && permissions.has(PERMISSIONS.PROJECT_RESTORE);
}

export function canHardDeleteProjectSnapshot(permissions: ReadonlySet<Permission>) {
  return permissions.has(PERMISSIONS.PROJECT_DELETE_ANY);
}
