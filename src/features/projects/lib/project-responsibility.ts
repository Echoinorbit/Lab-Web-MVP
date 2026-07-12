import type { Prisma } from "@prisma/client";

import {
  createActorSnapshot,
  parseActorSnapshot,
  type ActorSnapshotV1,
} from "@/shared/lib/actor-snapshot";
import {
  getLockedActiveActor,
  lockUserLifecycle,
  orderUserLifecycleLockIds,
} from "@/shared/lib/user-lifecycle-lock";

import { isEligibleProjectLeaderActor } from "./project-governance";
import { lockProjectLeaderAssignment } from "./project-state-service";

export const ACTIVE_PROJECT_ADVISOR_RESPONSIBILITY_MESSAGE =
  "该导师仍负责未结束的项目，请先归档或完成相关项目。";
export const PROJECT_REACTIVATION_ADVISOR_REQUIRED_MESSAGE =
  "项目负责导师不存在、已停用或导师身份已失效，无法恢复项目。";
export const PROJECT_RESPONSIBILITY_CHANGED_MESSAGE = "项目责任人已变化，请刷新后重试。";

type ProjectLeaderCandidate = {
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "SUSPENDED" | "GRADUATED";
  studyDegree: "MASTER" | "DOCTOR" | "MENTOR" | null;
  identityNeedsReview: boolean;
  advisorId: string | null;
};

type ProjectAdvisorCandidate = Pick<
  ProjectLeaderCandidate,
  "role" | "status" | "studyDegree" | "identityNeedsReview"
>;

export function isCanonicalProjectAdvisorEligible(candidate: ProjectAdvisorCandidate | null) {
  return Boolean(
    candidate
    && candidate.role === "MEMBER"
    && candidate.status === "ACTIVE"
    && !candidate.identityNeedsReview
    && candidate.studyDegree === "MENTOR",
  );
}

export function isCanonicalProjectLeaderEligible(
  candidate: ProjectLeaderCandidate | null,
  projectAdvisorId: string | null,
) {
  return Boolean(
    candidate
    && projectAdvisorId
    && isEligibleProjectLeaderActor(candidate)
    && candidate.advisorId === projectAdvisorId,
  );
}

export function shouldProjectRequireLeaderReassignment(project: {
  deletedAt: Date | string | null;
  archivedAt: Date | string | null;
  status: string;
}) {
  return !project.deletedAt
    && !project.archivedAt
    && project.status !== "ARCHIVED"
    && project.status !== "COMPLETED";
}

export async function assertNoActiveProjectAdvisorResponsibilities(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const activeProject = await tx.project.findFirst({
    where: {
      advisorId: userId,
      archivedAt: null,
      status: { not: "COMPLETED" },
    },
    select: { id: true },
  });
  if (activeProject) throw new Error(ACTIVE_PROJECT_ADVISOR_RESPONSIBILITY_MESSAGE);
}

export async function getProjectAdvisorLifecycleUserIds(
  tx: Prisma.TransactionClient,
  advisorId: string,
) {
  const [advisees, projectLeaders] = await Promise.all([
    tx.user.findMany({
      where: { advisorId },
      select: { id: true },
    }),
    tx.project.findMany({
      where: { advisorId, leaderId: { not: null } },
      select: { leaderId: true },
    }),
  ]);
  return orderUserLifecycleLockIds([
    ...advisees.map(({ id }) => id),
    ...projectLeaders.flatMap(({ leaderId }) => leaderId ? [leaderId] : []),
  ]);
}

export async function lockProjectResponsibilityContext(
  tx: Prisma.TransactionClient,
  input: { projectId: string; actorId: string },
) {
  const initial = await tx.project.findUnique({
    where: { id: input.projectId },
    select: { advisorId: true, leaderId: true },
  });
  if (!initial) return null;

  for (const userId of orderUserLifecycleLockIds([
    input.actorId,
    ...(initial.advisorId ? [initial.advisorId] : []),
    ...(initial.leaderId ? [initial.leaderId] : []),
  ])) {
    await lockUserLifecycle(tx, userId);
  }
  await lockProjectLeaderAssignment(tx, input.projectId);

  const project = await tx.project.findUnique({
    where: { id: input.projectId },
    select: {
      id: true,
      name: true,
      status: true,
      deletedAt: true,
      archivedAt: true,
      advisorId: true,
      leaderId: true,
      leaderSnapshot: true,
    },
  });
  if (!project) return null;
  if (project.advisorId !== initial.advisorId || project.leaderId !== initial.leaderId) {
    throw new Error(PROJECT_RESPONSIBILITY_CHANGED_MESSAGE);
  }

  const [actor, advisor, leader] = await Promise.all([
    getLockedActiveActor(tx, input.actorId),
    project.advisorId
      ? tx.user.findUnique({
          where: { id: project.advisorId },
          select: {
            role: true,
            status: true,
            studyDegree: true,
            identityNeedsReview: true,
          },
        })
      : null,
    project.leaderId
      ? tx.user.findUnique({
          where: { id: project.leaderId },
          select: {
            displayName: true,
            role: true,
            status: true,
            studyDegree: true,
            identityNeedsReview: true,
            advisorId: true,
          },
        })
      : null,
  ]);
  return { project, actor, advisor, leader };
}

export async function reconcileCanonicalProjectLeadershipForUser(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    projectId?: string;
    now: Date;
    force?: boolean;
    leaderSnapshot?: ActorSnapshotV1;
    revokedBy?: { id: string; snapshot: ActorSnapshotV1 } | null;
  },
) {
  const projectIds = (await tx.project.findMany({
    where: {
      leaderId: input.userId,
      ...(input.projectId ? { id: input.projectId } : {}),
    },
    select: { id: true },
    orderBy: { id: "asc" },
  })).map(({ id }) => id);
  const reconciledProjectIds: string[] = [];

  for (const projectId of projectIds) {
    await lockProjectLeaderAssignment(tx, projectId);
    const [project, candidate] = await Promise.all([
      tx.project.findUnique({
        where: { id: projectId },
        select: {
          leaderId: true,
          leaderSnapshot: true,
          advisorId: true,
          deletedAt: true,
          archivedAt: true,
          status: true,
        },
      }),
      tx.user.findUnique({
        where: { id: input.userId },
        select: {
          displayName: true,
          role: true,
          status: true,
          studyDegree: true,
          identityNeedsReview: true,
          advisorId: true,
        },
      }),
    ]);
    if (
      !project
      || project.leaderId !== input.userId
      || (!input.force && isCanonicalProjectLeaderEligible(candidate, project.advisorId))
    ) {
      continue;
    }

    const leaderSnapshot = input.leaderSnapshot
      ?? (candidate ? createActorSnapshot(candidate, input.now) : parseActorSnapshot(project.leaderSnapshot));
    if (!leaderSnapshot) throw new Error("项目负责人署名无法保留，已中止责任变更。");

    await tx.project.update({
      where: { id: projectId },
      data: {
        leaderId: null,
        leaderSnapshot,
        leaderNeedsReassignment: shouldProjectRequireLeaderReassignment(project),
      },
    });
    await tx.userTag.updateMany({
      where: {
        userId: input.userId,
        projectId,
        source: "PROJECT_LEAD",
        revokedAt: null,
      },
      data: {
        revokedAt: input.now,
        ...(input.revokedBy
          ? {
              revokedById: input.revokedBy.id,
              revokerSnapshot: input.revokedBy.snapshot,
            }
          : {}),
      },
    });
    reconciledProjectIds.push(projectId);
  }

  return reconciledProjectIds;
}

export async function reconcileCanonicalProjectLeadershipForAdvisor(
  tx: Prisma.TransactionClient,
  input: {
    advisorId: string;
    now: Date;
    revokedBy?: { id: string; snapshot: ActorSnapshotV1 } | null;
  },
) {
  const responsibilities = await tx.project.findMany({
    where: { advisorId: input.advisorId, leaderId: { not: null } },
    select: { id: true, leaderId: true },
    orderBy: { id: "asc" },
  });
  const reconciledProjectIds: string[] = [];
  for (const project of responsibilities) {
    if (!project.leaderId) continue;
    reconciledProjectIds.push(...await reconcileCanonicalProjectLeadershipForUser(tx, {
      userId: project.leaderId,
      projectId: project.id,
      now: input.now,
      force: true,
      revokedBy: input.revokedBy,
    }));
  }
  return reconciledProjectIds;
}
