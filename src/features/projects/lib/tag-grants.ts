import type { Prisma } from "@prisma/client";

import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { PROJECT_LEAD_TAG_PREFIX, PROJECT_MEMBER_TAG_PREFIX } from "@/shared/lib/system-tags";
import { lockUserLifecycle, orderUserLifecycleLockIds } from "@/shared/lib/user-lifecycle-lock";

import { isEligibleProjectLeaderActor } from "./project-governance";

export type ProjectScopedTagKind = "lead" | "member";

const tagConfig = {
  lead: {
    prefix: PROJECT_LEAD_TAG_PREFIX,
    templateName: "project-lead",
    displaySuffix: "项目组长",
  },
  member: {
    prefix: PROJECT_MEMBER_TAG_PREFIX,
    templateName: "project-member",
    displaySuffix: "项目成员",
  },
} as const satisfies Record<ProjectScopedTagKind, { prefix: string; templateName: string; displaySuffix: string }>;

export function projectScopedTagName(kind: ProjectScopedTagKind, projectId: string) {
  return `${tagConfig[kind].prefix}:${projectId}`;
}

export async function ensureProjectScopedTag(
  tx: Prisma.TransactionClient,
  {
    kind,
    projectId,
    projectName,
  }: {
    kind: ProjectScopedTagKind;
    projectId: string;
    projectName: string;
  },
) {
  const config = tagConfig[kind];
  const template = await tx.tagTemplate.findUniqueOrThrow({
    where: { name: config.templateName },
    select: { id: true },
  });

  return tx.tag.upsert({
    where: { name: projectScopedTagName(kind, projectId) },
    create: {
      name: projectScopedTagName(kind, projectId),
      displayName: `${projectName} - ${config.displaySuffix}`,
      scope: "PROJECT",
      templateId: template.id,
      isSystem: true,
    },
    update: {},
    select: { id: true, displayName: true },
  });
}

export async function grantProjectScopedTag(
  tx: Prisma.TransactionClient,
  {
    kind,
    userId,
    projectId,
    projectName,
    grantedById,
  }: {
    kind: ProjectScopedTagKind;
    userId: string;
    projectId: string;
    projectName: string;
    grantedById: string;
  },
) {
  for (const lockedUserId of orderUserLifecycleLockIds([grantedById, userId])) {
    await lockUserLifecycle(tx, lockedUserId);
  }
  const [member, actor, [{ now }]] = await Promise.all([
    tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        role: true,
        displayName: true,
        studyDegree: true,
        status: true,
        identityNeedsReview: true,
      },
    }),
    tx.user.findUniqueOrThrow({
      where: { id: grantedById },
      select: { displayName: true, studyDegree: true, status: true },
    }),
    tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
  ]);
  if (!isEligibleProjectLeaderActor(member)) {
    throw new Error("项目成员必须是身份已确认的在读硕士或博士成员。");
  }
  if (actor.status !== "ACTIVE") throw new Error("执行项目成员变更的账号已失效。");
  const memberSnapshot = createActorSnapshot(member, now);
  const actorSnapshot = createActorSnapshot(actor, now);
  await tx.projectMember.upsert({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
    create: {
      userId,
      projectId,
      memberSnapshot,
    },
    update: { memberSnapshot },
  });

  const tag = await ensureProjectScopedTag(tx, { kind, projectId, projectName });
  const existingGrant = await tx.userTag.findFirst({
    where: {
      userId,
      tagId: tag.id,
      projectId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: { id: true },
  });
  if (!existingGrant) {
    await tx.userTag.create({
      data: {
        userId,
        tagId: tag.id,
        projectId,
        grantedById,
        granterSnapshot: actorSnapshot,
        source: kind === "lead" ? "PROJECT_LEAD" : "MANUAL",
      },
    });
  }

  return tag;
}
