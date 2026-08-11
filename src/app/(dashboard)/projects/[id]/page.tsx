import type { Prisma } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

import { ProjectDetail } from "@/features/projects";
import type { ProjectCanvasSourceNode } from "@/features/projects/lib/node-canvas";
import { isCanonicalProjectLeaderEligible } from "@/features/projects/lib/project-responsibility";
import { canViewProject } from "@/features/projects/lib/visibility";
import {
  canEditProjectSnapshot,
  canHardDeleteProjectSnapshot,
  canManageProjectNodesSnapshot,
  canManageProjectLeaderReassignment,
  canRestoreProjectSnapshot,
  canSoftDeleteProjectSnapshot,
  isEligibleProjectLeaderActor,
} from "@/features/projects/lib/project-governance";
import { FORBIDDEN_ROUTE } from "@/shared/lib/access-denied";
import {
  formatActorDisplayName,
  getActorDisplayAccountState,
  resolveActorDisplay,
} from "@/shared/lib/actor-snapshot";
import { getEffectiveTags, getProjectPermissions, getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { formatStudyGrade } from "@/shared/lib/study-identity";

type ProjectNodeWithAuthor = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  nodeType: ProjectCanvasSourceNode["nodeType"];
  parentId: string | null;
  authorId: string | null;
  colorHex: string | null;
  createdAt: Date;
  author: { displayName: string; studyDegree: "MASTER" | "DOCTOR" | "MENTOR" | null; status: "ACTIVE" | "SUSPENDED" | "GRADUATED" } | null;
  authorSnapshot: Prisma.JsonValue;
};

function buildCanvasNodes(nodes: readonly ProjectNodeWithAuthor[]): ProjectCanvasSourceNode[] {
  return nodes.map((node) => ({
    id: node.id,
    projectId: node.projectId,
    title: node.title,
    description: node.description ?? undefined,
    nodeType: node.nodeType,
    parentId: node.parentId,
    authorId: node.authorId ?? "deleted-user",
    authorName: formatActorDisplayName(resolveActorDisplay(
      node.author,
      node.authorSnapshot,
    )),
    createdAt: node.createdAt.toISOString(),
    colorHex: node.colorHex,
  }));
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireActiveUser();
  const [project, effectiveTags] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, studyDegree: true, status: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        nodes: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          include: { author: { select: { displayName: true, studyDegree: true, status: true } } },
        },
        creator: {
          select: { displayName: true, studyDegree: true, status: true },
        },
        advisor: {
          select: {
            id: true,
            username: true,
            displayName: true,
            studyDegree: true,
            status: true,
            students: {
              where: { role: "MEMBER", status: "ACTIVE" },
              orderBy: [{ displayName: "asc" }],
              select: {
                id: true,
                username: true,
                displayName: true,
                studyDegree: true,
                studyGrade: true,
                studentId: true,
                identityNeedsReview: true,
              },
            },
          },
        },
        leader: {
          select: {
            displayName: true,
            role: true,
            studyDegree: true,
            status: true,
            identityNeedsReview: true,
            advisorId: true,
          },
        },
      },
    }),
    getEffectiveTags(user.id),
  ]);
  if (!project) notFound();
  if (project.deletedAt && user.role !== "ADMIN") notFound();
  if (!canViewProject({ id: user.id, role: user.role, tags: effectiveTags }, project)) {
    redirect(FORBIDDEN_ROUTE);
  }

  const [projectPermissions, globalPermissions] = await Promise.all([
    getProjectPermissions(user.id, id),
    getUserPermissions(user.id),
  ]);
  const combinedPermissions = new Set([...projectPermissions, ...globalPermissions]);
  const isProjectLead = project.leaderId === user.id
    && isCanonicalProjectLeaderEligible(project.leader, project.advisorId);
  const canManageProjectNodes = canManageProjectNodesSnapshot(user.id, isProjectLead, project, {
    projectPermissions,
    globalPermissions,
  });
  const isArchived = project.status === "ARCHIVED";
  const isDeleted = Boolean(project.deletedAt);
  const canReassignLeader = project.leaderNeedsReassignment
    && !isArchived
    && project.status !== "COMPLETED"
    && canManageProjectLeaderReassignment(user.id, user.role, project, globalPermissions);
  const canManageMembers = (isProjectLead || projectPermissions.has(PERMISSIONS.PROJECT_MEMBER_MANAGE))
    && !isArchived
    && !isDeleted;
  const memberIds = new Set(project.members.flatMap((member) => member.userId ? [member.userId] : []));
  const availableAdvisor = canManageMembers && project.advisor
    ? {
        ...project.advisor,
        students: project.advisor.students
          .filter((student) => !memberIds.has(student.id))
          .map((student) => ({ ...student, grade: formatStudyGrade(student.studyDegree, student.studyGrade) })),
      }
    : undefined;
  const leaderCandidates = canReassignLeader && project.advisor
    ? project.advisor.students
        .filter((student) => isEligibleProjectLeaderActor({
          role: "MEMBER",
          status: "ACTIVE",
          studyDegree: student.studyDegree,
          identityNeedsReview: student.identityNeedsReview,
        }))
        .map((student) => ({ ...student, grade: formatStudyGrade(student.studyDegree, student.studyGrade) }))
    : [];
  const creator = resolveActorDisplay(project.creator, project.creatorSnapshot);
  const advisor = resolveActorDisplay(project.advisor, project.advisorSnapshot);
  const leader = resolveActorDisplay(project.leader, project.leaderSnapshot);

  return (
    <ProjectDetail
      id={project.id}
      name={project.name}
      status={project.status}
      description={project.description ?? undefined}
      archivedAt={project.archivedAt?.toISOString() ?? null}
      deletedAt={project.deletedAt?.toISOString() ?? null}
      viewerId={user.id}
      creator={{
        displayName: creator.displayName,
        accountState: getActorDisplayAccountState(creator),
      }}
      advisor={{
        displayName: advisor.displayName,
        accountState: getActorDisplayAccountState(advisor),
      }}
      leader={{
        displayName: leader.displayName,
        accountState: getActorDisplayAccountState(leader),
      }}
      canvasNodes={buildCanvasNodes(project.nodes)}
      members={project.members.map((member) => ({
        id: member.user?.id ?? member.id,
        username: member.user?.username ?? null,
        displayName: formatActorDisplayName(resolveActorDisplay(member.user, member.memberSnapshot)),
      }))}
      availableAdvisor={availableAdvisor}
      leaderCandidates={leaderCandidates}
      parentOptions={project.nodes.map((node) => ({ id: node.id, title: node.title }))}
      leaderNeedsReassignment={project.leaderNeedsReassignment}
      canReassignLeader={canReassignLeader}
      canManageMembers={canManageMembers}
      canCreateNode={(canManageProjectNodes || projectPermissions.has(PERMISSIONS.PROJECT_NODE_CREATE)) && !isDeleted}
      canManageAllNodes={canManageProjectNodes && !isDeleted}
      canArchive={(isProjectLead
        || globalPermissions.has(PERMISSIONS.PROJECT_ARCHIVE_ANY)
        || projectPermissions.has(PERMISSIONS.PROJECT_MANAGE)) && !isDeleted}
      canEdit={canEditProjectSnapshot(user.id, isProjectLead, project, { globalPermissions, projectPermissions })}
      canSoftDelete={canSoftDeleteProjectSnapshot(user.id, project, combinedPermissions)}
      canRestore={canRestoreProjectSnapshot(project, combinedPermissions)}
      canHardDelete={canHardDeleteProjectSnapshot(combinedPermissions)}
    />
  );
}
