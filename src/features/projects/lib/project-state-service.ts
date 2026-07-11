import { Prisma } from "@prisma/client";

import { lockUserLifecycle, orderUserLifecycleLockIds } from "@/features/admin/lib/user-lifecycle";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";

import { ensureProjectScopedTag } from "./tag-grants";

const PROJECT_LEADER_LOCK_PREFIX = "lab-platform:project-leader:v1:";

export async function assignProjectLeader(
  tx: Prisma.TransactionClient,
  input: { projectId: string; leaderId: string; actorId: string },
) {
  for (const userId of orderUserLifecycleLockIds([input.actorId, input.leaderId])) {
    await lockUserLifecycle(tx, userId);
  }
  await tx.$executeRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${PROJECT_LEADER_LOCK_PREFIX + input.projectId}, 0))
  `);
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Project" WHERE "id" = ${input.projectId} FOR UPDATE`);
  const [project, leader, actor, [{ now }]] = await Promise.all([
    tx.project.findFirstOrThrow({
      where: { id: input.projectId, deletedAt: null },
      select: { id: true, name: true, advisorId: true },
    }),
    tx.user.findFirst({
      where: {
        id: input.leaderId,
        role: "MEMBER",
        status: "ACTIVE",
        identityNeedsReview: false,
        studyDegree: { in: ["MASTER", "DOCTOR"] },
      },
      select: { id: true, advisorId: true, displayName: true, studyDegree: true, status: true },
    }),
    tx.user.findUniqueOrThrow({
      where: { id: input.actorId },
      select: { displayName: true, studyDegree: true, status: true },
    }),
    tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT transaction_timestamp() AS now`),
  ]);
  if (!leader || !project.advisorId || leader.advisorId !== project.advisorId) {
    throw new Error("项目组长必须是负责导师的直属在读硕士或博士成员。");
  }
  if (actor.status !== "ACTIVE") throw new Error("执行项目负责人变更的账号已失效。");

  const actorSnapshot = createActorSnapshot(actor, now);
  const leaderSnapshot = createActorSnapshot(leader, now);
  const tag = await ensureProjectScopedTag(tx, {
    kind: "lead",
    projectId: project.id,
    projectName: project.name,
  });
  await tx.userTag.updateMany({
    where: {
      projectId: project.id,
      revokedAt: null,
      OR: [{ source: "PROJECT_LEAD" }, { tagId: tag.id }],
    },
    data: { revokedAt: now, revokedById: input.actorId, revokerSnapshot: actorSnapshot },
  });
  await tx.projectMember.upsert({
    where: { userId_projectId: { userId: leader.id, projectId: project.id } },
    create: { userId: leader.id, projectId: project.id, memberSnapshot: leaderSnapshot },
    update: { memberSnapshot: leaderSnapshot },
  });
  await tx.userTag.create({
    data: {
      userId: leader.id,
      tagId: tag.id,
      projectId: project.id,
      grantedById: input.actorId,
      granterSnapshot: actorSnapshot,
      source: "PROJECT_LEAD",
    },
  });
  await tx.project.update({
    where: { id: project.id },
    data: { leaderId: leader.id, leaderSnapshot, leaderNeedsReassignment: false },
  });
  await tx.auditLog.create({
    data: {
      userId: input.actorId,
      actorSnapshot,
      action: "UPDATE",
      entityType: "ProjectLeader",
      entityId: project.id,
      details: { leaderId: leader.id },
    },
  });
}
