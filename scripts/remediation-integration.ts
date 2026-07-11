import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { PrismaClient, type StudyDegree, type StudyGrade } from "@prisma/client";
import { loadEnvConfig } from "@next/env";

import { deleteUserAccount } from "../src/features/admin/lib/delete-user-account";
import { cancelUserGraduation, graduateUser } from "../src/features/admin/lib/user-lifecycle";
import { resolveProgressWriteWindow } from "../src/features/progress/lib/backfill";
import { assignProjectLeader } from "../src/features/projects/lib/project-state-service";
import { createActorSnapshot } from "../src/shared/lib/actor-snapshot";
import { getShanghaiDateParts } from "../src/shared/lib/date";
import { studyDegreeTagName } from "../src/shared/lib/study-identity";

loadEnvConfig(process.cwd());

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL is required for remediation integration tests.");

const schema = `remediation_it_${Date.now()}_${randomUUID().slice(0, 8)}`;
if (!/^remediation_it_[a-z0-9_]+$/.test(schema)) throw new Error("Unsafe disposable schema name.");
const disposable = new URL(sourceUrl);
disposable.searchParams.set("schema", schema);
const disposableUrl = disposable.toString();
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const commandEnv = {
  ...process.env,
  DATABASE_URL: disposableUrl,
  ADMIN_USERNAME: "integration-admin",
  ADMIN_PASSWORD: "Integration.pass.123",
  ADMIN_DISPLAY_NAME: "集成测试管理员",
};

function run(command: string, args: string[]) {
  execFileSync(command, args, { cwd: process.cwd(), env: commandEnv, stdio: "inherit" });
}

async function createMember(
  prisma: PrismaClient,
  admin: { id: string; displayName: string; studyDegree: StudyDegree | null; status: "ACTIVE" },
  input: {
    username: string;
    displayName: string;
    studyDegree: StudyDegree;
    studyGrade: StudyGrade | null;
    advisorId?: string;
  },
) {
  const now = new Date();
  const adminSnapshot = createActorSnapshot(admin, now);
  const user = await prisma.user.create({
    data: {
      username: input.username,
      passwordHash: "integration-only",
      displayName: input.displayName,
      role: "MEMBER",
      status: "ACTIVE",
      mustChangePassword: false,
      studyDegree: input.studyDegree,
      studyGrade: input.studyGrade,
      advisorId: input.advisorId,
    },
  });
  const tag = await prisma.tag.findUniqueOrThrow({ where: { name: studyDegreeTagName(input.studyDegree) } });
  await prisma.userTag.create({
    data: {
      userId: user.id,
      tagId: tag.id,
      grantedById: admin.id,
      granterSnapshot: adminSnapshot,
      source: "STUDY_IDENTITY",
    },
  });
  return user;
}

async function verifyLifecycleAndDeletion(prisma: PrismaClient, admin: { id: string }) {
  const student = await prisma.user.findUniqueOrThrow({ where: { username: "integration-lifecycle" } });
  const first = await prisma.$transaction((tx) => graduateUser(tx, { userId: student.id, actorId: admin.id }));
  assert.equal(first.scheduledDeletionAt.getTime() - first.graduatedAt.getTime(), 72 * 60 * 60 * 1000);
  const graduated = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
  assert.equal(graduated.status, "GRADUATED");
  const graduatedTags = await prisma.userTag.findMany({
    where: { userId: student.id, revokedAt: null },
    include: { tag: { select: { name: true } } },
  });
  assert.deepEqual(
    graduatedTags.map((grant) => [grant.tag.name, grant.source]),
    [["graduated", "MANUAL"]],
  );

  await prisma.$transaction((tx) => cancelUserGraduation(tx, { userId: student.id, actorId: admin.id }));
  const restored = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
  assert.equal(restored.status, "ACTIVE");
  assert.equal(restored.graduatedAt, null);
  assert.equal(restored.scheduledDeletionAt, null);
  const restoredTags = await prisma.userTag.findMany({
    where: { userId: student.id, revokedAt: null },
    include: { tag: { select: { name: true } } },
  });
  assert.deepEqual(restoredTags.map((grant) => [grant.tag.name, grant.source]), [["grad-master", "STUDY_IDENTITY"]]);

  await prisma.$transaction((tx) => graduateUser(tx, { userId: student.id, actorId: admin.id }));
  const dueAt = new Date(Date.now() - 60_000);
  await prisma.user.update({
    where: { id: student.id },
    data: { graduatedAt: new Date(dueAt.getTime() - 72 * 60 * 60 * 1000), scheduledDeletionAt: dueAt },
  });
  const post = await prisma.post.create({
    data: {
      authorId: student.id,
      authorSnapshot: createActorSnapshot(restored, new Date()),
      title: "integration scheduled deletion attribution",
      content: "historical content must survive scheduled account deletion",
    },
  });
  const deletion = await prisma.$transaction((tx) => deleteUserAccount(tx, student.id, { kind: "scheduled" }));
  assert.deepEqual(deletion, { deleted: true, avatar: null, reason: "deleted" });
  assert.equal(await prisma.user.findUnique({ where: { id: student.id } }), null);
  const retained = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
  assert.equal(retained.authorId, null);
  assert.equal((retained.authorSnapshot as { accountState?: string }).accountState, "GRADUATED");
  const retry = await prisma.$transaction((tx) => deleteUserAccount(tx, student.id, { kind: "scheduled" }));
  assert.equal(retry.reason, "already_absent");
}

async function verifyProjectTriggersAndLeaderSerialization(
  prisma: PrismaClient,
  admin: { id: string },
  mentor: { id: string; displayName: string; studyDegree: StudyDegree | null; status: "ACTIVE" },
  candidates: Array<{ id: string; username: string; displayName: string; studyDegree: StudyDegree | null; status: "ACTIVE" }>,
) {
  const mentorSnapshot = createActorSnapshot(mentor, new Date());
  const project = await prisma.project.create({
    data: {
      name: "integration project state",
      description: "database trigger and leader serialization coverage",
      creatorId: mentor.id,
      creatorSnapshot: mentorSnapshot,
      advisorId: mentor.id,
      advisorSnapshot: mentorSnapshot,
      status: "IN_PROGRESS",
    },
  });
  assert.equal(project.status, "PLANNING");

  const node = await prisma.projectNode.create({
    data: {
      projectId: project.id,
      authorId: candidates[0]!.id,
      authorSnapshot: createActorSnapshot(candidates[0]!, new Date()),
      title: "integration node",
      description: "creating a node must derive IN_PROGRESS",
      nodeType: "MILESTONE",
    },
  });
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).status, "IN_PROGRESS");
  await prisma.projectNode.update({ where: { id: node.id }, data: { deletedAt: new Date() } });
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).status, "PLANNING");
  await prisma.project.update({ where: { id: project.id }, data: { archivedAt: new Date() } });
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).status, "ARCHIVED");
  await prisma.project.update({ where: { id: project.id }, data: { archivedAt: null, status: "COMPLETED" } });
  await prisma.projectNode.update({ where: { id: node.id }, data: { deletedAt: null } });
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).status, "COMPLETED");
  await prisma.project.update({ where: { id: project.id }, data: { status: "PLANNING" } });

  await Promise.all(candidates.map((candidate) => prisma.$transaction(
    (tx) => assignProjectLeader(tx, { projectId: project.id, leaderId: candidate.id, actorId: admin.id }),
    { timeout: 15_000 },
  )));
  const assigned = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
  const activeLeadGrants = await prisma.userTag.findMany({
    where: { projectId: project.id, source: "PROJECT_LEAD", revokedAt: null },
  });
  assert.equal(activeLeadGrants.length, 1);
  assert.equal(activeLeadGrants[0]!.userId, assigned.leaderId);

  const leader = candidates.find((candidate) => candidate.id === assigned.leaderId);
  assert(leader);
  const post = await prisma.post.create({
    data: {
      authorId: leader.id,
      authorSnapshot: createActorSnapshot(leader, new Date()),
      title: "integration manual deletion attribution",
      content: "leader history must survive permanent deletion",
    },
  });
  await prisma.$transaction((tx) => deleteUserAccount(tx, leader.id, {
    kind: "manual",
    actorId: admin.id,
    confirmUsername: leader.username,
  }));
  const reassignment = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
  assert.equal(reassignment.leaderId, null);
  assert.equal(reassignment.leaderNeedsReassignment, true);
  assert.equal((reassignment.leaderSnapshot as { accountState?: string }).accountState, "DELETED");
  const retained = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
  assert.equal(retained.authorId, null);
  assert.equal((retained.authorSnapshot as { displayName?: string }).displayName, leader.displayName);
}

async function verifySettings(prisma: PrismaClient, admin: { id: string; displayName: string; studyDegree: StudyDegree | null; status: "ACTIVE" }, userId: string) {
  const initial = await prisma.systemSetting.findUniqueOrThrow({ where: { id: "singleton" } });
  const snapshot = createActorSnapshot(admin, new Date());
  const { year, month, day } = getShanghaiDateParts();
  const closedDay = day === 31 ? 1 : day + 1;
  const closed = await prisma.systemSetting.updateMany({
    where: { id: "singleton", revision: initial.revision },
    data: {
      progressStartDay: closedDay,
      progressStartMinute: 0,
      progressEndDay: closedDay,
      progressEndMinute: 1,
      sessionHours: 2,
      revision: { increment: 1 },
      updatedById: admin.id,
      updatedBySnapshot: snapshot,
    },
  });
  assert.equal(closed.count, 1);
  assert.equal((await resolveProgressWriteWindow(userId, year, month, prisma)).allowed, false);
  const stale = await prisma.systemSetting.updateMany({
    where: { id: "singleton", revision: initial.revision },
    data: { sessionHours: 3, revision: { increment: 1 } },
  });
  assert.equal(stale.count, 0);
  const current = await prisma.systemSetting.findUniqueOrThrow({ where: { id: "singleton" } });
  const opened = await prisma.systemSetting.updateMany({
    where: { id: "singleton", revision: current.revision },
    data: {
      progressStartDay: day,
      progressStartMinute: 0,
      progressEndDay: day,
      progressEndMinute: 1439,
      revision: { increment: 1 },
    },
  });
  assert.equal(opened.count, 1);
  assert.equal((await resolveProgressWriteWindow(userId, year, month, prisma)).allowed, true);
  assert.equal((await prisma.systemSetting.findUniqueOrThrow({ where: { id: "singleton" } })).sessionHours, 2);
}

async function main() {
  let prisma: PrismaClient | undefined;
  try {
    run(npx, ["prisma", "migrate", "deploy"]);
    run(npm, ["run", "seed"]);
    prisma = new PrismaClient({ datasourceUrl: disposableUrl });
    const seededAdmin = await prisma.user.findUniqueOrThrow({ where: { username: "integration-admin" } });
    const admin = { ...seededAdmin, status: "ACTIVE" as const };
    const mentor = await createMember(prisma, admin, {
      username: "integration-mentor",
      displayName: "集成测试导师",
      studyDegree: "MENTOR",
      studyGrade: null,
    });
    const leaderA = await createMember(prisma, admin, {
      username: "integration-leader-a",
      displayName: "集成组长甲",
      studyDegree: "MASTER",
      studyGrade: "MASTER_1",
      advisorId: mentor.id,
    });
    const leaderB = await createMember(prisma, admin, {
      username: "integration-leader-b",
      displayName: "集成组长乙",
      studyDegree: "DOCTOR",
      studyGrade: "DOCTOR_1",
      advisorId: mentor.id,
    });
    await createMember(prisma, admin, {
      username: "integration-lifecycle",
      displayName: "集成生命周期学生",
      studyDegree: "MASTER",
      studyGrade: "MASTER_2",
      advisorId: mentor.id,
    });

    await verifySettings(prisma, admin, leaderA.id);
    await verifyLifecycleAndDeletion(prisma, admin);
    await verifyProjectTriggersAndLeaderSerialization(
      prisma,
      admin,
      { ...mentor, status: "ACTIVE" },
      [{ ...leaderA, status: "ACTIVE" }, { ...leaderB, status: "ACTIVE" }],
    );

    console.log(JSON.stringify({
      schema,
      checks: [
        "formal migrations and seed on an isolated schema",
        "persisted progress window plus optimistic revision conflict",
        "graduation, cancellation, 72-hour schedule, and idempotent scheduled deletion",
        "historical attribution retained after scheduled/manual deletion",
        "project PLANNING/IN_PROGRESS/ARCHIVED/COMPLETED trigger priority",
        "concurrent leader assignment leaves one canonical PROJECT_LEAD projection",
        "deleted active leader becomes an explicit reassignment task",
      ],
    }, null, 2));
  } finally {
    await prisma?.$disconnect();
    const cleanup = new PrismaClient({ datasourceUrl: sourceUrl });
    try {
      await cleanup.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await cleanup.$disconnect();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
