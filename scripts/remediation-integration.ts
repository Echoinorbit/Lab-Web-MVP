import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaClient, type StudyDegree, type StudyGrade } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import ExcelJS from "exceljs";

import { deleteUserAccount } from "../src/features/admin/lib/delete-user-account";
import { executeAuditExport } from "../src/features/admin/lib/audit-export";
import {
  applyStudyIdentityUpdate,
  syncStudyIdentity,
} from "../src/features/admin/lib/study-identity-service";
import { applyAdminUserRoleUpdate } from "../src/features/admin/lib/user-governance";
import { cancelUserGraduation, graduateUser } from "../src/features/admin/lib/user-lifecycle";
import {
  openProgressBackfillWindowForUser,
  resolveProgressWriteWindow,
} from "../src/features/progress/lib/backfill";
import { assignProjectLeader } from "../src/features/projects/lib/project-state-service";
import {
  ACTIVE_PROJECT_ADVISOR_RESPONSIBILITY_MESSAGE,
  getProjectAdvisorLifecycleUserIds,
  reconcileCanonicalProjectLeadershipForUser,
} from "../src/features/projects/lib/project-responsibility";
import { createActorSnapshot } from "../src/shared/lib/actor-snapshot";
import { appendAuditLog } from "../src/shared/lib/audit";
import { getShanghaiDateParts } from "../src/shared/lib/date";
import { studyDegreeTagName } from "../src/shared/lib/study-identity";
import {
  getLockedActiveActor,
  lockAllUserLifecycles,
  lockUserAdvisorRelations,
  lockUserLifecycle,
  orderUserLifecycleLockIds,
} from "../src/shared/lib/user-lifecycle-lock";
import { buildReport } from "./report-remediation-readiness";

loadEnvConfig(process.cwd());

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL is required for remediation integration tests.");

const schema = `remediation_it_${Date.now()}_${randomUUID().slice(0, 8)}`;
if (!/^remediation_it_[a-z0-9_]+$/.test(schema)) throw new Error("Unsafe disposable schema name.");
const upgradeSchema = `remediation_upgrade_${Date.now()}_${randomUUID().slice(0, 8)}`;
if (!/^remediation_upgrade_[a-z0-9_]+$/.test(upgradeSchema)) throw new Error("Unsafe upgrade schema name.");
const disposable = new URL(sourceUrl);
disposable.searchParams.set("schema", schema);
const disposableUrl = disposable.toString();
const upgradeDisposable = new URL(sourceUrl);
upgradeDisposable.searchParams.set("schema", upgradeSchema);
const upgradeDisposableUrl = upgradeDisposable.toString();
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const commandEnv = {
  ...process.env,
  DATABASE_URL: disposableUrl,
  ADMIN_USERNAME: "integration-admin",
  ADMIN_PASSWORD: "Integration.pass.123",
  ADMIN_DISPLAY_NAME: "集成测试管理员",
};
const upgradeCommandEnv = { ...commandEnv, DATABASE_URL: upgradeDisposableUrl };
const legacyMigrationNames = [
  "20260622140500_initial",
  "20260624181959_feedback_patch_round1",
  "20260625173008_web_architecture_advice",
  "20260627063314_feedback_patch_round4_identity",
  "20260629131356_drop_unused_user_post_tags",
] as const;
const remediationMigrationNames = [
  "20260710140000_fullstack_remediation",
  "20260712143000_reconcile_project_responsibilities",
] as const;

function run(command: string, args: string[], env = commandEnv) {
  execFileSync(command, args, { cwd: process.cwd(), env, stdio: "inherit" });
}

async function dropSchema(targetSchema: string) {
  const cleanup = new PrismaClient({ datasourceUrl: sourceUrl });
  try {
    await cleanup.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${targetSchema}" CASCADE`);
  } finally {
    await cleanup.$disconnect();
  }
}

function deployLegacyMigrationBoundary() {
  const temporaryPrismaRoot = mkdtempSync(join(tmpdir(), "lab-remediation-legacy-"));
  const temporaryMigrations = join(temporaryPrismaRoot, "migrations");
  try {
    mkdirSync(temporaryMigrations);
    cpSync(join(process.cwd(), "prisma", "schema.prisma"), join(temporaryPrismaRoot, "schema.prisma"));
    cpSync(
      join(process.cwd(), "prisma", "migrations", "migration_lock.toml"),
      join(temporaryMigrations, "migration_lock.toml"),
    );
    for (const migrationName of legacyMigrationNames) {
      cpSync(
        join(process.cwd(), "prisma", "migrations", migrationName),
        join(temporaryMigrations, migrationName),
        { recursive: true },
      );
    }
    run(
      npx,
      ["prisma", "migrate", "deploy", "--schema", join(temporaryPrismaRoot, "schema.prisma")],
      upgradeCommandEnv,
    );
  } finally {
    rmSync(temporaryPrismaRoot, { recursive: true, force: true });
  }
}

async function migrationHistory(prisma: PrismaClient) {
  const rows = await prisma.$queryRawUnsafe<Array<{ migrationName: string }>>(`
    SELECT "migration_name" AS "migrationName"
    FROM "_prisma_migrations"
    WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
    ORDER BY "started_at", "migration_name"
  `);
  return rows.map((row) => row.migrationName);
}

async function rollbackCounts(prisma: PrismaClient) {
  const rows = await prisma.$queryRawUnsafe<Array<{ tableName: string; rowCount: number }>>(`
    SELECT 'Announcement' AS "tableName", count(*)::int AS "rowCount" FROM "Announcement"
    UNION ALL SELECT 'AuditLog', count(*)::int FROM "AuditLog"
    UNION ALL SELECT 'Comment', count(*)::int FROM "Comment"
    UNION ALL SELECT 'Notification', count(*)::int FROM "Notification"
    UNION ALL SELECT 'Post', count(*)::int FROM "Post"
    UNION ALL SELECT 'ProgressReport', count(*)::int FROM "ProgressReport"
    UNION ALL SELECT 'Project', count(*)::int FROM "Project"
    UNION ALL SELECT 'ProjectMember', count(*)::int FROM "ProjectMember"
    UNION ALL SELECT 'ProjectNode', count(*)::int FROM "ProjectNode"
    UNION ALL SELECT 'User', count(*)::int FROM "User"
    ORDER BY "tableName"
  `);
  return Object.fromEntries(rows.map((row) => [row.tableName, row.rowCount]));
}

async function insertLegacyFixtures(prisma: PrismaClient) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`
      INSERT INTO "User" (
        "id", "username", "passwordHash", "displayName", "role", "status", "grade",
        "advisorId", "mustChangePassword", "createdAt", "updatedAt"
      ) VALUES
        ('legacy-admin', 'legacy-admin', 'legacy-only', '旧库管理员', 'ADMIN', 'ACTIVE', '研1', NULL, false, '2026-05-01', '2026-06-01'),
        ('legacy-master-grade', 'legacy-master-grade', 'legacy-only', '年级推导硕士', 'MEMBER', 'ACTIVE', ' 研2 ', NULL, false, '2026-05-01', '2026-06-01'),
        ('legacy-expired-master', 'legacy-expired-master', 'legacy-only', '过期标签硕士', 'MEMBER', 'ACTIVE', '研1', NULL, false, '2026-05-01', '2026-06-01'),
        ('legacy-tag-conflict', 'legacy-tag-conflict', 'legacy-only', '身份标签冲突', 'MEMBER', 'ACTIVE', '研1', NULL, false, '2026-05-01', '2026-06-01'),
        ('legacy-grade-conflict', 'legacy-grade-conflict', 'legacy-only', '学位年级冲突', 'MEMBER', 'ACTIVE', '博2', NULL, false, '2026-05-01', '2026-06-01'),
        ('legacy-unmapped', 'legacy-unmapped', 'legacy-only', '未映射年级', 'MEMBER', 'ACTIVE', '未知年级', 'legacy-mentor', false, '2026-05-01', '2026-06-01'),
        ('legacy-missing', 'legacy-missing', 'legacy-only', '身份证据缺失', 'MEMBER', 'ACTIVE', ' ', NULL, false, '2026-05-01', '2026-06-01'),
        ('legacy-mentor-grade', 'legacy-mentor-grade', 'legacy-only', '导师携带年级', 'MEMBER', 'ACTIVE', '研1', NULL, false, '2026-05-01', '2026-06-01'),
        ('legacy-graduated-master', 'legacy-graduated-master', 'legacy-only', '旧库毕业硕士', 'MEMBER', 'GRADUATED', '研3', 'legacy-mentor', false, '2026-05-01', '2026-06-01'),
        ('legacy-graduated-mentor', 'legacy-graduated-mentor', 'legacy-only', '旧库毕业导师', 'MEMBER', 'GRADUATED', NULL, NULL, false, '2026-05-01', '2026-06-01'),
        ('legacy-invalid-advisor-student', 'legacy-invalid-advisor-student', 'legacy-only', '失效导师直属学生', 'MEMBER', 'ACTIVE', '研1', 'legacy-graduated-mentor', false, '2026-05-01', '2026-06-01'),
        ('legacy-leader-b', 'legacy-leader-b', 'legacy-only', '旧库候选组长乙', 'MEMBER', 'ACTIVE', '博1', 'legacy-mentor', false, '2026-05-01', '2026-06-01'),
        ('legacy-mentor', 'legacy-mentor', 'legacy-only', '旧库导师', 'MEMBER', 'ACTIVE', NULL, NULL, false, '2026-05-01', '2026-06-01'),
        ('legacy-actor', 'legacy-actor', 'legacy-only', '旧库内容作者', 'MEMBER', 'ACTIVE', '博3', 'legacy-mentor', false, '2026-05-01', '2026-06-01')
    `);

    await tx.$executeRawUnsafe(`
      INSERT INTO "TagTemplate" (
        "id", "name", "displayName", "permissions", "createdAt", "updatedAt"
      ) VALUES (
        'legacy-project-lead-template', 'project-lead', '项目组长', '["PROJECT_MEMBER_MANAGE"]'::jsonb,
        '2026-05-01', '2026-06-01'
      )
    `);

    await tx.$executeRawUnsafe(`
      INSERT INTO "Tag" (
        "id", "name", "displayName", "permissions", "scope", "isSystem", "templateId", "createdAt", "updatedAt"
      ) VALUES
        ('legacy-tag-master', 'grad-master', '研究生', '[]'::jsonb, 'GLOBAL', true, NULL, '2026-05-01', '2026-06-01'),
        ('legacy-tag-doctor', 'grad-phd', '博士生', '[]'::jsonb, 'GLOBAL', true, NULL, '2026-05-01', '2026-06-01'),
        ('legacy-tag-mentor', 'advisor', '导师', '[]'::jsonb, 'GLOBAL', true, NULL, '2026-05-01', '2026-06-01'),
        ('legacy-tag-custom', 'legacy-custom', '旧库自定义标签', '["POST_CREATE"]'::jsonb, 'GLOBAL', false, NULL, '2026-05-01', '2026-06-01')
    `);

    await tx.$executeRawUnsafe(`
      INSERT INTO "Project" (
        "id", "name", "description", "status", "creatorId", "advisorId",
        "createdAt", "updatedAt", "deletedAt", "archivedAt"
      ) VALUES
        ('legacy-project-single', '旧库唯一组长项目', 'single leader', 'PLANNING', 'legacy-actor', 'legacy-mentor', '2026-05-01', '2026-06-01', NULL, NULL),
        ('legacy-project-empty', '旧库空节点项目', 'empty project', 'REVIEW', 'legacy-actor', 'legacy-mentor', '2026-05-01', '2026-06-02', NULL, NULL),
        ('legacy-project-archived', '旧库缺时间归档项目', 'archived without timestamp', 'ARCHIVED', 'legacy-actor', 'legacy-mentor', '2026-05-01', '2026-06-03', NULL, NULL),
        ('legacy-project-completed', '旧库已完成项目', 'completed priority', 'COMPLETED', 'legacy-actor', 'legacy-mentor', '2026-05-01', '2026-06-04', NULL, NULL),
        ('legacy-project-ambiguous', '旧库多组长项目', 'ambiguous leaders', 'REVIEW', 'legacy-actor', 'legacy-mentor', '2026-05-01', '2026-06-05', NULL, NULL),
        ('legacy-project-expired', '旧库过期组长项目', 'expired leader', 'IN_PROGRESS', 'legacy-actor', 'legacy-mentor', '2026-05-01', '2026-06-06', NULL, NULL),
        ('legacy-project-inactive', '旧库失效组长项目', 'inactive leader', 'PLANNING', 'legacy-actor', 'legacy-mentor', '2026-05-01', '2026-06-06', NULL, NULL),
        ('legacy-project-invalid-advisor', '旧库失效导师项目', 'invalid advisor', 'PLANNING', 'legacy-actor', 'legacy-graduated-mentor', '2026-05-01', '2026-06-06', NULL, NULL),
        ('legacy-project-admin', '旧库管理员组长项目', 'admin leader', 'PLANNING', 'legacy-actor', 'legacy-mentor', '2026-05-01', '2026-06-06', NULL, NULL),
        ('legacy-project-mentor', '旧库导师组长项目', 'mentor leader', 'PLANNING', 'legacy-actor', 'legacy-graduated-mentor', '2026-05-01', '2026-06-06', NULL, NULL),
        ('legacy-project-unresolved', '旧库待确认组长项目', 'unresolved leader', 'PLANNING', 'legacy-actor', 'legacy-mentor', '2026-05-01', '2026-06-06', NULL, NULL),
        ('legacy-project-wrong-advisor', '旧库跨导师组长项目', 'wrong advisor leader', 'PLANNING', 'legacy-actor', 'legacy-graduated-mentor', '2026-05-01', '2026-06-06', NULL, NULL),
        ('legacy-project-deleted', '旧库已删除项目', 'deleted project', 'REVIEW', 'legacy-actor', 'legacy-mentor', '2026-05-01', '2026-06-07', '2026-06-08', NULL)
    `);

    await tx.$executeRawUnsafe(`
      INSERT INTO "Tag" (
        "id", "name", "displayName", "permissions", "scope", "isSystem", "templateId", "createdAt", "updatedAt"
      ) VALUES
        ('legacy-lead-single', 'project-lead:legacy-project-single', '唯一组长', '[]'::jsonb, 'PROJECT', true, 'legacy-project-lead-template', '2026-05-01', '2026-06-01'),
        ('legacy-lead-empty', 'project-lead:legacy-project-empty', '空节点组长', '[]'::jsonb, 'PROJECT', true, 'legacy-project-lead-template', '2026-05-01', '2026-06-01'),
        ('legacy-lead-ambiguous', 'project-lead:legacy-project-ambiguous', '多组长', '[]'::jsonb, 'PROJECT', true, 'legacy-project-lead-template', '2026-05-01', '2026-06-01'),
        ('legacy-lead-expired', 'project-lead:legacy-project-expired', '过期组长', '[]'::jsonb, 'PROJECT', true, 'legacy-project-lead-template', '2026-05-01', '2026-06-01'),
        ('legacy-lead-inactive', 'project-lead:legacy-project-inactive', '失效组长', '[]'::jsonb, 'PROJECT', true, 'legacy-project-lead-template', '2026-05-01', '2026-06-01'),
        ('legacy-lead-invalid-advisor', 'project-lead:legacy-project-invalid-advisor', '失效导师组长', '[]'::jsonb, 'PROJECT', true, 'legacy-project-lead-template', '2026-05-01', '2026-06-01'),
        ('legacy-lead-admin', 'project-lead:legacy-project-admin', '管理员组长', '[]'::jsonb, 'PROJECT', true, 'legacy-project-lead-template', '2026-05-01', '2026-06-01'),
        ('legacy-lead-mentor', 'project-lead:legacy-project-mentor', '导师组长', '[]'::jsonb, 'PROJECT', true, 'legacy-project-lead-template', '2026-05-01', '2026-06-01'),
        ('legacy-lead-unresolved', 'project-lead:legacy-project-unresolved', '待确认组长', '[]'::jsonb, 'PROJECT', true, 'legacy-project-lead-template', '2026-05-01', '2026-06-01'),
        ('legacy-lead-wrong-advisor', 'project-lead:legacy-project-wrong-advisor', '跨导师组长', '[]'::jsonb, 'PROJECT', true, 'legacy-project-lead-template', '2026-05-01', '2026-06-01')
    `);

    await tx.$executeRawUnsafe(`
      INSERT INTO "UserTag" (
        "id", "userId", "tagId", "projectId", "grantedById", "expiresAt", "revokedAt", "revokedById", "createdAt"
      ) VALUES
        ('ut-admin-master', 'legacy-admin', 'legacy-tag-master', NULL, 'legacy-admin', NULL, NULL, NULL, '2026-05-01'),
        ('ut-conflict-master', 'legacy-tag-conflict', 'legacy-tag-master', NULL, 'legacy-admin', NULL, NULL, NULL, '2026-05-01'),
        ('ut-conflict-doctor', 'legacy-tag-conflict', 'legacy-tag-doctor', NULL, 'legacy-admin', NULL, NULL, NULL, '2026-05-02'),
        ('ut-grade-conflict', 'legacy-grade-conflict', 'legacy-tag-master', NULL, 'legacy-admin', NULL, NULL, NULL, '2026-05-01'),
        ('ut-unmapped', 'legacy-unmapped', 'legacy-tag-master', NULL, 'legacy-admin', NULL, NULL, NULL, '2026-05-01'),
        ('ut-mentor-grade', 'legacy-mentor-grade', 'legacy-tag-mentor', NULL, 'legacy-admin', NULL, NULL, NULL, '2026-05-01'),
        ('ut-graduated-mentor', 'legacy-graduated-mentor', 'legacy-tag-mentor', NULL, 'legacy-admin', NULL, NULL, NULL, '2026-05-01'),
        ('ut-mentor', 'legacy-mentor', 'legacy-tag-mentor', NULL, 'legacy-admin', NULL, NULL, NULL, '2026-05-01'),
        ('ut-expired-doctor', 'legacy-expired-master', 'legacy-tag-doctor', NULL, 'legacy-admin', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL, NULL, '2026-05-01'),
        ('ut-lead-single', 'legacy-actor', 'legacy-lead-single', 'legacy-project-single', 'legacy-admin', NULL, NULL, NULL, '2026-05-01'),
        ('ut-lead-empty', 'legacy-leader-b', 'legacy-lead-empty', 'legacy-project-empty', 'legacy-admin', NULL, NULL, NULL, '2026-05-01'),
        ('ut-lead-ambiguous-a', 'legacy-actor', 'legacy-lead-ambiguous', 'legacy-project-ambiguous', 'legacy-admin', NULL, NULL, NULL, '2026-05-01'),
        ('ut-lead-ambiguous-b', 'legacy-leader-b', 'legacy-lead-ambiguous', 'legacy-project-ambiguous', 'legacy-admin', NULL, NULL, NULL, '2026-05-02'),
        ('ut-lead-expired', 'legacy-leader-b', 'legacy-lead-expired', 'legacy-project-expired', 'legacy-admin', CURRENT_TIMESTAMP - INTERVAL '1 day', NULL, NULL, '2026-05-03'),
        ('ut-lead-inactive', 'legacy-graduated-master', 'legacy-lead-inactive', 'legacy-project-inactive', 'legacy-admin', NULL, NULL, NULL, '2026-05-03'),
        ('ut-lead-invalid-advisor', 'legacy-invalid-advisor-student', 'legacy-lead-invalid-advisor', 'legacy-project-invalid-advisor', 'legacy-admin', NULL, NULL, NULL, '2026-05-03'),
        ('ut-lead-admin', 'legacy-admin', 'legacy-lead-admin', 'legacy-project-admin', 'legacy-admin', NULL, NULL, NULL, '2026-05-03'),
        ('ut-lead-mentor', 'legacy-mentor', 'legacy-lead-mentor', 'legacy-project-mentor', 'legacy-admin', NULL, NULL, NULL, '2026-05-03'),
        ('ut-lead-unresolved', 'legacy-unmapped', 'legacy-lead-unresolved', 'legacy-project-unresolved', 'legacy-admin', NULL, NULL, NULL, '2026-05-03'),
        ('ut-lead-wrong-advisor', 'legacy-leader-b', 'legacy-lead-wrong-advisor', 'legacy-project-wrong-advisor', 'legacy-admin', NULL, NULL, NULL, '2026-05-03'),
        ('ut-custom-revoked', 'legacy-actor', 'legacy-tag-custom', NULL, 'legacy-admin', NULL, '2026-05-10', 'legacy-admin', '2026-05-01')
    `);

    await tx.$executeRawUnsafe(`
      INSERT INTO "Announcement" (
        "id", "title", "content", "authorId", "createdAt", "updatedAt"
      ) VALUES ('legacy-announcement', '旧库公告', '保留公告署名', 'legacy-actor', '2026-05-01', '2026-06-01')
    `);
    await tx.$executeRawUnsafe(`
      INSERT INTO "Post" (
        "id", "title", "content", "authorId", "createdAt", "updatedAt"
      ) VALUES
        ('legacy-post', '旧库帖子', '保留作者署名', 'legacy-actor', '2026-05-01', '2026-06-01'),
        ('legacy-post-graduated', '旧库毕业生帖子', '保留毕业状态', 'legacy-graduated-master', '2026-05-01', '2026-06-01')
    `);
    await tx.$executeRawUnsafe(`
      INSERT INTO "Comment" (
        "id", "content", "authorId", "postId", "createdAt", "updatedAt"
      ) VALUES ('legacy-comment', '旧库评论', 'legacy-actor', 'legacy-post', '2026-05-01', '2026-06-01')
    `);
    await tx.$executeRawUnsafe(`
      INSERT INTO "ProjectNode" (
        "id", "title", "description", "nodeType", "projectId", "authorId", "createdAt", "updatedAt"
      ) VALUES
        ('legacy-node-single', '唯一组长项目节点', 'status becomes in progress', 'UPDATE', 'legacy-project-single', 'legacy-actor', '2026-05-01', '2026-06-01'),
        ('legacy-node-archived', '归档项目节点', 'archive wins', 'UPDATE', 'legacy-project-archived', 'legacy-actor', '2026-05-01', '2026-06-01'),
        ('legacy-node-completed', '完成项目节点', 'completed wins', 'UPDATE', 'legacy-project-completed', 'legacy-actor', '2026-05-01', '2026-06-01'),
        ('legacy-node-ambiguous', '多组长项目节点', 'ambiguous leader remains explicit', 'UPDATE', 'legacy-project-ambiguous', 'legacy-actor', '2026-05-01', '2026-06-01')
    `);
    await tx.$executeRawUnsafe(`
      INSERT INTO "ProgressReport" (
        "id", "userId", "year", "month", "studySummary", "createdAt", "updatedAt"
      ) VALUES ('legacy-report', 'legacy-actor', 2026, 5, '旧库进度', '2026-05-01', '2026-06-01')
    `);
    await tx.$executeRawUnsafe(`
      INSERT INTO "Notification" (
        "id", "userId", "senderId", "type", "title", "createdAt"
      ) VALUES ('legacy-notification', 'legacy-actor', 'legacy-mentor', 'SYSTEM', '旧库通知', '2026-05-01')
    `);
    await tx.$executeRawUnsafe(`
      INSERT INTO "AuditLog" (
        "id", "userId", "action", "entityType", "entityId", "details", "createdAt"
      ) VALUES ('legacy-audit', 'legacy-actor', 'UPDATE', 'LegacyFixture', 'legacy-actor', '{"fixture":true}'::jsonb, '2026-05-01')
    `);
  });
}

function snapshot(value: unknown) {
  assert(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

const legacyIdentityDecisions: Array<{
  userId: string;
  studyDegree: StudyDegree;
  studyGrade: StudyGrade | null;
  confirmGraduatedRepair?: boolean;
}> = [
  { userId: "legacy-grade-conflict", studyDegree: "DOCTOR", studyGrade: "DOCTOR_2" },
  {
    userId: "legacy-graduated-mentor",
    studyDegree: "MASTER",
    studyGrade: "MASTER_3",
    confirmGraduatedRepair: true,
  },
  { userId: "legacy-mentor-grade", studyDegree: "MENTOR", studyGrade: null },
  { userId: "legacy-missing", studyDegree: "MASTER", studyGrade: "MASTER_0" },
  { userId: "legacy-tag-conflict", studyDegree: "MASTER", studyGrade: "MASTER_1" },
  { userId: "legacy-unmapped", studyDegree: "MASTER", studyGrade: "MASTER_1" },
];

async function reconcileRetainedLegacyAmbiguity(
  prisma: PrismaClient,
  initialReport: Awaited<ReturnType<typeof buildReport>>,
) {
  await prisma.$transaction(async (tx) => {
    const [[{ now }], admin] = await Promise.all([
      tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
      tx.user.findUniqueOrThrow({
        where: { id: "legacy-admin" },
        select: { displayName: true, studyDegree: true, status: true },
      }),
    ]);
    const actorSnapshot = createActorSnapshot(admin, now);
    for (const project of initialReport.projectsWithoutLeader) {
      await tx.project.update({
        where: { id: project.id },
        data: {
          status: "ARCHIVED",
          archivedAt: now,
          archivedById: "legacy-admin",
          archivedBySnapshot: actorSnapshot,
          leaderNeedsReassignment: false,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: "legacy-admin",
          actorSnapshot,
          action: "UPDATE",
          entityType: "Project",
          entityId: project.id,
          details: { status: "ARCHIVED", scope: "ADMIN_MIGRATION_RECONCILIATION" },
        },
      });
    }
  });

  for (const decision of legacyIdentityDecisions) {
    await prisma.$transaction(async (tx) => {
      await lockUserAdvisorRelations(tx);
      const relatedUserIds = await getProjectAdvisorLifecycleUserIds(tx, decision.userId);
      for (const userId of orderUserLifecycleLockIds([
        "legacy-admin",
        decision.userId,
        ...relatedUserIds,
      ])) {
        await lockUserLifecycle(tx, userId);
      }
      const result = await applyStudyIdentityUpdate(tx, {
        ...decision,
        actorId: "legacy-admin",
      });
      await tx.auditLog.create({
        data: {
          userId: "legacy-admin",
          actorSnapshot: result.identitySync.actorSnapshot,
          action: "UPDATE",
          entityType: "User",
          entityId: decision.userId,
          details: {
            repairedGraduatedIdentity: result.repairingGraduatedIdentity,
            releasedAdviseeCount: result.identitySync.releasedAdviseeCount,
            releasedProjectLeaderIds: result.identitySync.reconciledProjectIds,
          },
        },
      });
    });
  }

  const repairedGraduatedUser = await prisma.user.findUniqueOrThrow({
    where: { id: "legacy-graduated-mentor" },
  });
  assert.equal(repairedGraduatedUser.status, "GRADUATED");
  assert.equal(repairedGraduatedUser.studyDegree, "MASTER");
  assert.equal(repairedGraduatedUser.studyGrade, "MASTER_3");
  assert.equal(repairedGraduatedUser.identityNeedsReview, false);
  assert.equal(repairedGraduatedUser.identityMigrationNote, null);
  assert(repairedGraduatedUser.graduatedAt);
  assert(repairedGraduatedUser.scheduledDeletionAt);
  assert.equal(
    repairedGraduatedUser.scheduledDeletionAt.getTime() - repairedGraduatedUser.graduatedAt.getTime(),
    72 * 60 * 60 * 1000,
  );
  const releasedAdvisee = await prisma.user.findUniqueOrThrow({
    where: { id: "legacy-invalid-advisor-student" },
  });
  assert.equal(releasedAdvisee.advisorId, null);
  assert.equal(snapshot(releasedAdvisee.advisorSnapshot).displayName, "旧库毕业导师");

  const finalReport = await buildReport(prisma);
  assert.equal(finalReport.ready, true);
  assert.deepEqual(finalReport.unresolvedIdentities, []);
  assert.deepEqual(finalReport.conflictingEffectiveIdentityTags, []);
  assert.deepEqual(finalReport.identityProjectionDrift, []);
  assert.deepEqual(finalReport.invalidAdvisorRelations, []);
  assert.deepEqual(finalReport.projectsWithoutLeader, []);
  assert.deepEqual(finalReport.invalidProjectLeaders, []);
  assert.deepEqual(finalReport.projectStatusDrift, []);
  assert.deepEqual(finalReport.lifecycleDrift, []);
  assert(Object.values(finalReport.missingSnapshots).every((count) => count === 0));
  return finalReport;
}

async function assertLegacyUpgrade(
  prisma: PrismaClient,
  beforeCounts: Record<string, number>,
  beforeGrades: Array<{ username: string; grade: string | null }>,
  beforeTagCount: number,
  beforeUserTagCount: number,
) {
  assert.deepEqual(await migrationHistory(prisma), [...legacyMigrationNames, ...remediationMigrationNames]);
  const afterCounts = await rollbackCounts(prisma);
  assert.deepEqual(afterCounts, {
    ...beforeCounts,
    ProjectMember: (beforeCounts.ProjectMember ?? 0) + 2,
  });

  const afterGrades = await prisma.user.findMany({
    where: { username: { startsWith: "legacy-" } },
    select: { username: true, legacyGrade: true },
    orderBy: { username: "asc" },
  });
  assert.deepEqual(
    afterGrades.map((row) => ({ username: row.username, grade: row.legacyGrade })),
    beforeGrades,
  );

  assert.equal(await prisma.tag.count(), beforeTagCount + 1);
  assert.equal(await prisma.userTag.count(), beforeUserTagCount + 8);
  assert.equal(await prisma.systemSetting.count(), 1);

  const identities = await prisma.user.findMany({
    where: { username: { startsWith: "legacy-" } },
    select: {
      username: true,
      studyDegree: true,
      studyGrade: true,
      identityNeedsReview: true,
      identityMigrationNote: true,
    },
    orderBy: { username: "asc" },
  });
  assert.deepEqual(identities, [
    { username: "legacy-actor", studyDegree: "DOCTOR", studyGrade: "DOCTOR_3", identityNeedsReview: false, identityMigrationNote: null },
    { username: "legacy-admin", studyDegree: null, studyGrade: null, identityNeedsReview: false, identityMigrationNote: null },
    { username: "legacy-expired-master", studyDegree: "MASTER", studyGrade: "MASTER_1", identityNeedsReview: false, identityMigrationNote: null },
    { username: "legacy-grade-conflict", studyDegree: "MASTER", studyGrade: null, identityNeedsReview: true, identityMigrationNote: "GRADE_DEGREE_CONFLICT" },
    { username: "legacy-graduated-master", studyDegree: "MASTER", studyGrade: "MASTER_3", identityNeedsReview: false, identityMigrationNote: null },
    { username: "legacy-graduated-mentor", studyDegree: "MENTOR", studyGrade: null, identityNeedsReview: true, identityMigrationNote: "MENTOR_GRADUATED_LEGACY" },
    { username: "legacy-invalid-advisor-student", studyDegree: "MASTER", studyGrade: "MASTER_1", identityNeedsReview: false, identityMigrationNote: null },
    { username: "legacy-leader-b", studyDegree: "DOCTOR", studyGrade: "DOCTOR_1", identityNeedsReview: false, identityMigrationNote: null },
    { username: "legacy-master-grade", studyDegree: "MASTER", studyGrade: "MASTER_2", identityNeedsReview: false, identityMigrationNote: null },
    { username: "legacy-mentor", studyDegree: "MENTOR", studyGrade: null, identityNeedsReview: false, identityMigrationNote: null },
    { username: "legacy-mentor-grade", studyDegree: "MENTOR", studyGrade: null, identityNeedsReview: true, identityMigrationNote: "MENTOR_HAS_LEGACY_GRADE" },
    { username: "legacy-missing", studyDegree: null, studyGrade: null, identityNeedsReview: true, identityMigrationNote: "IDENTITY_EVIDENCE_MISSING" },
    { username: "legacy-tag-conflict", studyDegree: null, studyGrade: null, identityNeedsReview: true, identityMigrationNote: "IDENTITY_TAG_CONFLICT" },
    { username: "legacy-unmapped", studyDegree: "MASTER", studyGrade: null, identityNeedsReview: true, identityMigrationNote: "GRADE_UNMAPPED" },
  ]);

  const graduatedMaster = await prisma.user.findUniqueOrThrow({ where: { id: "legacy-graduated-master" } });
  assert(graduatedMaster.graduatedAt);
  assert(graduatedMaster.scheduledDeletionAt);
  assert.equal(
    graduatedMaster.scheduledDeletionAt.getTime() - graduatedMaster.graduatedAt.getTime(),
    72 * 60 * 60 * 1000,
  );
  const graduatedMentor = await prisma.user.findUniqueOrThrow({ where: { id: "legacy-graduated-mentor" } });
  assert.equal(graduatedMentor.graduatedAt, null);
  assert.equal(graduatedMentor.scheduledDeletionAt, null);

  const protectedIdentityTags = await prisma.$queryRawUnsafe<Array<{
    username: string;
    tagName: string;
    source: string;
  }>>(`
    SELECT u."username", t."name" AS "tagName", ut."source"::text AS "source"
    FROM "UserTag" ut
    JOIN "User" u ON u."id" = ut."userId"
    JOIN "Tag" t ON t."id" = ut."tagId"
    WHERE u."username" LIKE 'legacy-%'
      AND ut."projectId" IS NULL
      AND ut."source" = 'STUDY_IDENTITY'
      AND ut."revokedAt" IS NULL
    ORDER BY u."username"
  `);
  assert.deepEqual(protectedIdentityTags, [
    { username: "legacy-actor", tagName: "grad-phd", source: "STUDY_IDENTITY" },
    { username: "legacy-expired-master", tagName: "grad-master", source: "STUDY_IDENTITY" },
    { username: "legacy-graduated-master", tagName: "grad-master", source: "STUDY_IDENTITY" },
    { username: "legacy-invalid-advisor-student", tagName: "grad-master", source: "STUDY_IDENTITY" },
    { username: "legacy-leader-b", tagName: "grad-phd", source: "STUDY_IDENTITY" },
    { username: "legacy-master-grade", tagName: "grad-master", source: "STUDY_IDENTITY" },
    { username: "legacy-mentor", tagName: "advisor", source: "STUDY_IDENTITY" },
  ]);

  const adminStudyTag = await prisma.userTag.findUniqueOrThrow({ where: { id: "ut-admin-master" } });
  assert.equal(adminStudyTag.source, "LEGACY");
  assert(adminStudyTag.revokedAt);
  const conflictedTags = await prisma.userTag.findMany({
    where: { id: { in: ["ut-conflict-doctor", "ut-conflict-master"] } },
    select: { id: true, source: true, revokedAt: true },
    orderBy: { id: "asc" },
  });
  assert.deepEqual(conflictedTags, [
    { id: "ut-conflict-doctor", source: "LEGACY", revokedAt: null },
    { id: "ut-conflict-master", source: "LEGACY", revokedAt: null },
  ]);
  const expiredTag = await prisma.userTag.findUniqueOrThrow({ where: { id: "ut-expired-doctor" } });
  assert.equal(expiredTag.source, "LEGACY");
  assert.equal(expiredTag.revokedAt, null);
  assert(expiredTag.expiresAt && expiredTag.expiresAt.getTime() < Date.now());

  const leadSources = await prisma.userTag.findMany({
    where: { id: { startsWith: "ut-lead-" } },
    select: { id: true, source: true, revokedAt: true },
    orderBy: { id: "asc" },
  });
  assert.deepEqual(leadSources.map((row) => ({ ...row, revokedAt: Boolean(row.revokedAt) })), [
    { id: "ut-lead-admin", source: "PROJECT_LEAD", revokedAt: true },
    { id: "ut-lead-ambiguous-a", source: "LEGACY", revokedAt: true },
    { id: "ut-lead-ambiguous-b", source: "LEGACY", revokedAt: true },
    { id: "ut-lead-empty", source: "PROJECT_LEAD", revokedAt: false },
    { id: "ut-lead-expired", source: "LEGACY", revokedAt: false },
    { id: "ut-lead-inactive", source: "PROJECT_LEAD", revokedAt: true },
    { id: "ut-lead-invalid-advisor", source: "PROJECT_LEAD", revokedAt: true },
    { id: "ut-lead-mentor", source: "PROJECT_LEAD", revokedAt: true },
    { id: "ut-lead-single", source: "PROJECT_LEAD", revokedAt: false },
    { id: "ut-lead-unresolved", source: "PROJECT_LEAD", revokedAt: true },
    { id: "ut-lead-wrong-advisor", source: "PROJECT_LEAD", revokedAt: true },
  ]);

  const canonicalMembers = await prisma.projectMember.findMany({
    where: { projectId: { in: ["legacy-project-empty", "legacy-project-single"] } },
    select: { projectId: true, userId: true, memberSnapshot: true },
    orderBy: { projectId: "asc" },
  });
  assert.deepEqual(canonicalMembers.map((member) => ({
    projectId: member.projectId,
    userId: member.userId,
  })), [
    { projectId: "legacy-project-empty", userId: "legacy-leader-b" },
    { projectId: "legacy-project-single", userId: "legacy-actor" },
  ]);
  assert(canonicalMembers.every((member) => member.memberSnapshot));

  const projects = await prisma.project.findMany({
    where: { id: { startsWith: "legacy-project-" } },
    select: {
      id: true,
      status: true,
      leaderId: true,
      leaderNeedsReassignment: true,
      archivedAt: true,
      updatedAt: true,
      leaderSnapshot: true,
    },
    orderBy: { id: "asc" },
  });
  assert.deepEqual(
    projects.map((project) => ({
      id: project.id,
      status: project.status,
      leaderId: project.leaderId,
      leaderNeedsReassignment: project.leaderNeedsReassignment,
    })),
    [
      { id: "legacy-project-admin", status: "PLANNING", leaderId: null, leaderNeedsReassignment: true },
      { id: "legacy-project-ambiguous", status: "IN_PROGRESS", leaderId: null, leaderNeedsReassignment: true },
      { id: "legacy-project-archived", status: "ARCHIVED", leaderId: null, leaderNeedsReassignment: false },
      { id: "legacy-project-completed", status: "COMPLETED", leaderId: null, leaderNeedsReassignment: false },
      { id: "legacy-project-deleted", status: "PLANNING", leaderId: null, leaderNeedsReassignment: false },
      { id: "legacy-project-empty", status: "PLANNING", leaderId: "legacy-leader-b", leaderNeedsReassignment: false },
      { id: "legacy-project-expired", status: "PLANNING", leaderId: null, leaderNeedsReassignment: true },
      { id: "legacy-project-inactive", status: "PLANNING", leaderId: null, leaderNeedsReassignment: true },
      { id: "legacy-project-invalid-advisor", status: "PLANNING", leaderId: null, leaderNeedsReassignment: true },
      { id: "legacy-project-mentor", status: "PLANNING", leaderId: null, leaderNeedsReassignment: true },
      { id: "legacy-project-single", status: "IN_PROGRESS", leaderId: "legacy-actor", leaderNeedsReassignment: false },
      { id: "legacy-project-unresolved", status: "PLANNING", leaderId: null, leaderNeedsReassignment: true },
      { id: "legacy-project-wrong-advisor", status: "PLANNING", leaderId: null, leaderNeedsReassignment: true },
    ],
  );
  const archivedProject = projects.find((project) => project.id === "legacy-project-archived");
  assert(archivedProject?.archivedAt);
  assert.equal(archivedProject.archivedAt.getTime(), archivedProject.updatedAt.getTime());
  assert.equal(snapshot(projects.find((project) => project.id === "legacy-project-ambiguous")?.leaderSnapshot).displayName, "旧库候选组长乙");
  assert.equal(snapshot(projects.find((project) => project.id === "legacy-project-expired")?.leaderSnapshot).displayName, "旧库候选组长乙");
  assert.equal(snapshot(projects.find((project) => project.id === "legacy-project-inactive")?.leaderSnapshot).displayName, "旧库毕业硕士");
  assert.equal(snapshot(projects.find((project) => project.id === "legacy-project-invalid-advisor")?.leaderSnapshot).displayName, "失效导师直属学生");
  assert.equal(snapshot(projects.find((project) => project.id === "legacy-project-admin")?.leaderSnapshot).displayName, "旧库管理员");
  assert.equal(snapshot(projects.find((project) => project.id === "legacy-project-mentor")?.leaderSnapshot).displayName, "旧库导师");
  assert.equal(snapshot(projects.find((project) => project.id === "legacy-project-unresolved")?.leaderSnapshot).displayName, "未映射年级");
  assert.equal(snapshot(projects.find((project) => project.id === "legacy-project-wrong-advisor")?.leaderSnapshot).displayName, "旧库候选组长乙");

  const report = await buildReport(prisma);
  assert.equal(report.ready, false);
  assert.deepEqual(report.identityReasonLedger, [
    { reason: "GRADE_DEGREE_CONFLICT", count: 1 },
    { reason: "GRADE_UNMAPPED", count: 1 },
    { reason: "IDENTITY_EVIDENCE_MISSING", count: 1 },
    { reason: "IDENTITY_TAG_CONFLICT", count: 1 },
    { reason: "MENTOR_GRADUATED_LEGACY", count: 1 },
    { reason: "MENTOR_HAS_LEGACY_GRADE", count: 1 },
  ]);
  assert.deepEqual(
    report.unresolvedIdentities.map((row) => [row.username, row.identityMigrationNote]).sort(),
    [
      ["legacy-grade-conflict", "GRADE_DEGREE_CONFLICT"],
      ["legacy-graduated-mentor", "MENTOR_GRADUATED_LEGACY"],
      ["legacy-mentor-grade", "MENTOR_HAS_LEGACY_GRADE"],
      ["legacy-missing", "IDENTITY_EVIDENCE_MISSING"],
      ["legacy-tag-conflict", "IDENTITY_TAG_CONFLICT"],
      ["legacy-unmapped", "GRADE_UNMAPPED"],
    ],
  );
  assert.deepEqual(report.conflictingEffectiveIdentityTags, [
    { userId: "legacy-tag-conflict", username: "legacy-tag-conflict", assignmentCount: 2 },
  ]);
  assert.deepEqual(report.identityProjectionDrift, []);
  assert.deepEqual(report.invalidAdvisorRelations, [
    {
      userId: "legacy-invalid-advisor-student",
      username: "legacy-invalid-advisor-student",
      role: "MEMBER",
      studyDegree: "MASTER",
      identityNeedsReview: false,
      advisorId: "legacy-graduated-mentor",
      advisorUsername: "legacy-graduated-mentor",
      advisorRole: "MEMBER",
      advisorStudyDegree: "MENTOR",
      advisorIdentityNeedsReview: true,
    },
    {
      userId: "legacy-unmapped",
      username: "legacy-unmapped",
      role: "MEMBER",
      studyDegree: "MASTER",
      identityNeedsReview: true,
      advisorId: "legacy-mentor",
      advisorUsername: "legacy-mentor",
      advisorRole: "MEMBER",
      advisorStudyDegree: "MENTOR",
      advisorIdentityNeedsReview: false,
    },
  ]);
  assert.deepEqual(
    report.projectsWithoutLeader
      .map((project) => ({ id: project.id, leaderNeedsReassignment: project.leaderNeedsReassignment }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    [
      { id: "legacy-project-admin", leaderNeedsReassignment: true },
      { id: "legacy-project-ambiguous", leaderNeedsReassignment: true },
      { id: "legacy-project-expired", leaderNeedsReassignment: true },
      { id: "legacy-project-inactive", leaderNeedsReassignment: true },
      { id: "legacy-project-invalid-advisor", leaderNeedsReassignment: true },
      { id: "legacy-project-mentor", leaderNeedsReassignment: true },
      { id: "legacy-project-unresolved", leaderNeedsReassignment: true },
      { id: "legacy-project-wrong-advisor", leaderNeedsReassignment: true },
    ],
  );
  assert.deepEqual(report.invalidProjectLeaders, []);
  assert.deepEqual(report.projectStatusDrift, []);
  assert.deepEqual(report.lifecycleDrift, []);
  assert.deepEqual(report.missingSnapshots, {
    announcements: 0,
    posts: 0,
    comments: 0,
    projectMembers: 0,
    projectNodes: 0,
    progressReports: 0,
    userAdvisors: 0,
    projectCreators: 0,
    projectAdvisors: 0,
    projectLeaders: 0,
    projectArchivers: 0,
    notificationSenders: 0,
    auditActors: 0,
    tagGranters: 0,
    tagRevokers: 0,
    settingEditors: 0,
  });

  const graduatedPost = await prisma.post.findUniqueOrThrow({ where: { id: "legacy-post-graduated" } });
  assert.equal(snapshot(graduatedPost.authorSnapshot).displayName, "旧库毕业硕士");
  assert.equal(snapshot(graduatedPost.authorSnapshot).accountState, "GRADUATED");
  const audit = await prisma.auditLog.findUniqueOrThrow({ where: { id: "legacy-audit" } });
  assert.equal(snapshot(audit.actorSnapshot).displayName, "旧库内容作者");
  const notification = await prisma.notification.findUniqueOrThrow({ where: { id: "legacy-notification" } });
  assert.equal(snapshot(notification.senderSnapshot).displayName, "旧库导师");
  const revokedGrant = await prisma.userTag.findUniqueOrThrow({ where: { id: "ut-custom-revoked" } });
  assert.equal(snapshot(revokedGrant.granterSnapshot).displayName, "旧库管理员");
  assert.equal(snapshot(revokedGrant.revokerSnapshot).displayName, "旧库管理员");

  const migrationStructuralCounts = {
    tags: { before: beforeTagCount, after: await prisma.tag.count() },
    userTags: { before: beforeUserTagCount, after: await prisma.userTag.count() },
    systemSettings: await prisma.systemSetting.count(),
  };
  const reconciledReport = await reconcileRetainedLegacyAmbiguity(prisma, report);

  return {
    migrationHistory: await migrationHistory(prisma),
    rowCounts: { before: beforeCounts, after: afterCounts },
    structuralCounts: migrationStructuralCounts,
    identityReasonLedger: report.identityReasonLedger,
    readiness: {
      initial: {
        ready: report.ready,
        unresolvedIdentityCount: report.unresolvedIdentities.length,
        invalidAdvisorRelationCount: report.invalidAdvisorRelations.length,
        projectsNeedingLeader: report.projectsWithoutLeader.length,
        missingSnapshots: report.missingSnapshots,
      },
      reconciled: {
        ready: reconciledReport.ready,
        unresolvedIdentityCount: reconciledReport.unresolvedIdentities.length,
        invalidAdvisorRelationCount: reconciledReport.invalidAdvisorRelations.length,
        projectsNeedingLeader: reconciledReport.projectsWithoutLeader.length,
      },
      missingSnapshots: report.missingSnapshots,
    },
  };
}

async function verifyLegacyUpgrade() {
  let prisma: PrismaClient | undefined;
  try {
    deployLegacyMigrationBoundary();
    prisma = new PrismaClient({ datasourceUrl: upgradeDisposableUrl });
    assert.deepEqual(await migrationHistory(prisma), [...legacyMigrationNames]);
    await insertLegacyFixtures(prisma);
    const beforeCounts = await rollbackCounts(prisma);
    const beforeGrades = await prisma.$queryRawUnsafe<Array<{ username: string; grade: string | null }>>(`
      SELECT "username", "grade" FROM "User" WHERE "username" LIKE 'legacy-%' ORDER BY "username"
    `);
    const beforeTagCount = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      'SELECT count(*)::int AS "count" FROM "Tag"',
    );
    const beforeUserTagCount = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      'SELECT count(*)::int AS "count" FROM "UserTag"',
    );
    await prisma.$disconnect();
    prisma = undefined;

    run(npx, ["prisma", "migrate", "deploy"], upgradeCommandEnv);
    prisma = new PrismaClient({ datasourceUrl: upgradeDisposableUrl });
    return await assertLegacyUpgrade(
      prisma,
      beforeCounts,
      beforeGrades,
      beforeTagCount[0]!.count,
      beforeUserTagCount[0]!.count,
    );
  } finally {
    await prisma?.$disconnect();
    await dropSchema(upgradeSchema);
  }
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

async function verifyActorWriteLifecycleSerialization(
  prisma: PrismaClient,
  admin: { id: string; displayName: string; studyDegree: StudyDegree | null; status: "ACTIVE" },
  mentorId: string,
) {
  const progressManagerTag = await prisma.tag.findUniqueOrThrow({ where: { name: "progress-mgr" } });
  await prisma.userTag.create({
    data: {
      userId: mentorId,
      tagId: progressManagerTag.id,
      grantedById: admin.id,
      granterSnapshot: createActorSnapshot(admin, new Date()),
    },
  });
  const writeFirst = await createMember(prisma, admin, {
    username: "integration-write-first",
    displayName: "写入先行学生",
    studyDegree: "MASTER",
    studyGrade: "MASTER_1",
    advisorId: mentorId,
  });
  let writerLocked!: () => void;
  let releaseWriter!: () => void;
  const writerLockReady = new Promise<void>((resolve) => { writerLocked = resolve; });
  const writerRelease = new Promise<void>((resolve) => { releaseWriter = resolve; });
  const write = prisma.$transaction(async (tx) => {
    const access = await getLockedActiveActor(tx, writeFirst.id);
    assert(access);
    writerLocked();
    await writerRelease;
    return tx.post.create({
      data: {
        authorId: writeFirst.id,
        authorSnapshot: access.actorSnapshot,
        title: "integration serialized actor write",
        content: "the lifecycle transition must wait for this active write",
      },
    });
  }, { timeout: 15_000 });
  await writerLockReady;

  let deletionEntered!: () => void;
  const deletionStarted = new Promise<void>((resolve) => { deletionEntered = resolve; });
  const deletion = prisma.$transaction(async (tx) => {
    deletionEntered();
    return deleteUserAccount(tx, writeFirst.id, {
      kind: "manual",
      actorId: admin.id,
      confirmUsername: writeFirst.username,
    });
  }, { timeout: 15_000 });
  await deletionStarted;
  const deletionCompletedBeforeWrite = await Promise.race([
    deletion.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
  ]);
  releaseWriter();
  const [post, deletionResult] = await Promise.all([write, deletion]);
  assert.equal(deletionCompletedBeforeWrite, false);
  assert.equal(deletionResult.deleted, true);
  const retainedPost = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
  assert.equal(retainedPost.authorId, null);
  assert.equal((retainedPost.authorSnapshot as { accountState?: string }).accountState, "DELETED");

  const graduationFirst = await createMember(prisma, admin, {
    username: "integration-graduation-first",
    displayName: "毕业先行学生",
    studyDegree: "DOCTOR",
    studyGrade: "DOCTOR_1",
    advisorId: mentorId,
  });
  let graduationLocked!: () => void;
  let releaseGraduation!: () => void;
  const graduationLockReady = new Promise<void>((resolve) => { graduationLocked = resolve; });
  const graduationRelease = new Promise<void>((resolve) => { releaseGraduation = resolve; });
  const graduation = prisma.$transaction(async (tx) => {
    const result = await graduateUser(tx, { userId: graduationFirst.id, actorId: admin.id });
    graduationLocked();
    await graduationRelease;
    return result;
  }, { timeout: 15_000 });
  await graduationLockReady;

  let blockedWriterEntered!: () => void;
  const blockedWriterStarted = new Promise<void>((resolve) => { blockedWriterEntered = resolve; });
  const blockedWrite = prisma.$transaction(async (tx) => {
    blockedWriterEntered();
    const access = await getLockedActiveActor(tx, graduationFirst.id);
    if (!access) return null;
    return tx.post.create({
      data: {
        authorId: graduationFirst.id,
        authorSnapshot: access.actorSnapshot,
        title: "forbidden stale actor write",
        content: "this row must never be created",
      },
    });
  }, { timeout: 15_000 });
  await blockedWriterStarted;
  const writeCompletedBeforeGraduation = await Promise.race([
    blockedWrite.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
  ]);
  releaseGraduation();
  const [graduationResult, blockedWriteResult] = await Promise.all([graduation, blockedWrite]);
  assert.equal(writeCompletedBeforeGraduation, false);
  assert.ok(graduationResult.scheduledDeletionAt > graduationResult.graduatedAt);
  assert.equal(blockedWriteResult, null);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: graduationFirst.id } })).status, "GRADUATED");
  assert.equal(await prisma.post.count({ where: { title: "forbidden stale actor write" } }), 0);

  const auditFirst = await createMember(prisma, admin, {
    username: "integration-audit-first",
    displayName: "审计先行学生",
    studyDegree: "MASTER",
    studyGrade: "MASTER_2",
    advisorId: mentorId,
  });
  const audit = await appendAuditLog({
    userId: auditFirst.id,
    action: "UPDATE",
    entityType: "LifecycleRace",
  }, prisma);
  await prisma.$transaction((tx) => deleteUserAccount(tx, auditFirst.id, {
    kind: "manual",
    actorId: admin.id,
    confirmUsername: auditFirst.username,
  }));
  const retainedAudit = await prisma.auditLog.findUniqueOrThrow({ where: { id: audit.id } });
  assert.equal(retainedAudit.userId, null);
  assert.equal((retainedAudit.actorSnapshot as { accountState?: string }).accountState, "DELETED");

  const deletionBeforeAudit = await createMember(prisma, admin, {
    username: "integration-deletion-before-audit",
    displayName: "删除先于审计学生",
    studyDegree: "DOCTOR",
    studyGrade: "DOCTOR_2",
    advisorId: mentorId,
  });
  let deletionReady!: () => void;
  let releaseAuditDeletion!: () => void;
  const deletionReadyPromise = new Promise<void>((resolve) => { deletionReady = resolve; });
  const auditDeletionRelease = new Promise<void>((resolve) => { releaseAuditDeletion = resolve; });
  const heldDeletion = prisma.$transaction(async (tx) => {
    const result = await deleteUserAccount(tx, deletionBeforeAudit.id, {
      kind: "manual",
      actorId: admin.id,
      confirmUsername: deletionBeforeAudit.username,
    });
    deletionReady();
    await auditDeletionRelease;
    return result;
  }, { timeout: 15_000 });
  await deletionReadyPromise;
  const lateAudit = appendAuditLog({
    userId: deletionBeforeAudit.id,
    action: "UPDATE",
    entityType: "LifecycleRace",
  }, prisma);
  const auditCompletedBeforeDeletion = await Promise.race([
    lateAudit.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
  ]);
  releaseAuditDeletion();
  const [heldDeletionResult, lateAuditResult] = await Promise.all([heldDeletion, lateAudit]);
  assert.equal(auditCompletedBeforeDeletion, false);
  assert.equal(heldDeletionResult.deleted, true);
  assert.equal(lateAuditResult.userId, null);
  assert.deepEqual(
    {
      displayName: (lateAuditResult.actorSnapshot as { displayName?: string }).displayName,
      accountState: (lateAuditResult.actorSnapshot as { accountState?: string }).accountState,
    },
    { displayName: deletionBeforeAudit.displayName, accountState: "DELETED" },
  );

  const suspensionFirst = await createMember(prisma, admin, {
    username: "integration-suspension-first",
    displayName: "停用先行学生",
    studyDegree: "MASTER",
    studyGrade: "MASTER_2",
    advisorId: mentorId,
  });
  let suspensionReady!: () => void;
  let releaseSuspension!: () => void;
  const suspensionReadyPromise = new Promise<void>((resolve) => { suspensionReady = resolve; });
  const suspensionRelease = new Promise<void>((resolve) => { releaseSuspension = resolve; });
  const suspension = prisma.$transaction(async (tx) => {
    for (const userId of orderUserLifecycleLockIds([admin.id, suspensionFirst.id])) {
      await lockUserLifecycle(tx, userId);
    }
    await tx.user.update({
      where: { id: suspensionFirst.id },
      data: { status: "SUSPENDED", tokenVersion: { increment: 1 } },
    });
    suspensionReady();
    await suspensionRelease;
  }, { timeout: 15_000 });
  await suspensionReadyPromise;
  const postAfterSuspension = prisma.$transaction(async (tx) => {
    const access = await getLockedActiveActor(tx, suspensionFirst.id);
    if (!access) return null;
    return tx.post.create({
      data: {
        authorId: suspensionFirst.id,
        authorSnapshot: access.actorSnapshot,
        title: "forbidden post after suspension",
        content: "a suspended actor cannot write",
      },
    });
  }, { timeout: 15_000 });
  const postCompletedBeforeSuspension = await Promise.race([
    postAfterSuspension.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
  ]);
  releaseSuspension();
  const [, suspendedPost] = await Promise.all([suspension, postAfterSuspension]);
  assert.equal(postCompletedBeforeSuspension, false);
  assert.equal(suspendedPost, null);
  assert.equal(await prisma.post.count({ where: { title: "forbidden post after suspension" } }), 0);

  const deletedBeforeBackfill = await createMember(prisma, admin, {
    username: "integration-delete-before-backfill",
    displayName: "删除先于补填学生",
    studyDegree: "MASTER",
    studyGrade: "MASTER_3",
    advisorId: mentorId,
  });
  let backfillDeletionReady!: () => void;
  let releaseBackfillDeletion!: () => void;
  const backfillDeletionReadyPromise = new Promise<void>((resolve) => { backfillDeletionReady = resolve; });
  const backfillDeletionRelease = new Promise<void>((resolve) => { releaseBackfillDeletion = resolve; });
  const heldBackfillDeletion = prisma.$transaction(async (tx) => {
    const result = await deleteUserAccount(tx, deletedBeforeBackfill.id, {
      kind: "manual",
      actorId: admin.id,
      confirmUsername: deletedBeforeBackfill.username,
    });
    backfillDeletionReady();
    await backfillDeletionRelease;
    return result;
  }, { timeout: 15_000 });
  await backfillDeletionReadyPromise;
  const lateBackfill = prisma.$transaction((tx) => openProgressBackfillWindowForUser(tx, {
    managerId: mentorId,
    userId: deletedBeforeBackfill.id,
    year: 2026,
    month: 6,
  }), { timeout: 15_000 }).then(
    () => null,
    (error: unknown) => error,
  );
  const backfillCompletedBeforeDeletion = await Promise.race([
    lateBackfill.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
  ]);
  releaseBackfillDeletion();
  const [, backfillError] = await Promise.all([heldBackfillDeletion, lateBackfill]);
  assert.equal(backfillCompletedBeforeDeletion, false);
  assert(backfillError instanceof Error);
  assert.match(backfillError.message, /目标成员不存在或账号不可用/);
  assert.equal(await prisma.progressBackfillWindow.count({ where: { userId: deletedBeforeBackfill.id } }), 0);
}

async function verifyLifecycleLockHierarchy(
  prisma: PrismaClient,
  admin: { id: string; displayName: string; studyDegree: StudyDegree | null; status: "ACTIVE" },
) {
  let bulkReady!: () => void;
  let releaseBulk!: () => void;
  const bulkReadyPromise = new Promise<void>((resolve) => { bulkReady = resolve; });
  const bulkRelease = new Promise<void>((resolve) => { releaseBulk = resolve; });
  const bulkRevocation = prisma.$transaction(async (tx) => {
    await lockAllUserLifecycles(tx);
    assert(await getLockedActiveActor(tx, admin.id));
    bulkReady();
    await bulkRelease;
    return tx.user.updateMany({ data: { tokenVersion: { increment: 1 } } });
  }, { timeout: 15_000 });
  await bulkReadyPromise;
  let actorReadStarted!: () => void;
  const actorReadStart = new Promise<void>((resolve) => { actorReadStarted = resolve; });
  const blockedActorRead = prisma.$transaction(async (tx) => {
    actorReadStarted();
    return getLockedActiveActor(tx, admin.id);
  }, { timeout: 15_000 });
  await actorReadStart;
  const actorReadCompletedBeforeBulk = await Promise.race([
    blockedActorRead.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
  ]);
  releaseBulk();
  const [bulkResult, activeActor] = await Promise.all([bulkRevocation, blockedActorRead]);
  assert.equal(actorReadCompletedBeforeBulk, false);
  assert.ok(bulkResult.count > 0);
  assert(activeActor);

  const mentor = await createMember(prisma, admin, {
    username: "integration-advisor-lock",
    displayName: "导师关系锁测试导师",
    studyDegree: "MENTOR",
    studyGrade: null,
  });
  const child = await createMember(prisma, admin, {
    username: "integration-advisee-lock",
    displayName: "导师关系锁测试学生",
    studyDegree: "MASTER",
    studyGrade: "MASTER_1",
    advisorId: mentor.id,
  });
  let relationReady!: () => void;
  let releaseRelation!: () => void;
  const relationReadyPromise = new Promise<void>((resolve) => { relationReady = resolve; });
  const relationRelease = new Promise<void>((resolve) => { releaseRelation = resolve; });
  const relationWrite = prisma.$transaction(async (tx) => {
    await lockUserAdvisorRelations(tx);
    for (const userId of orderUserLifecycleLockIds([admin.id, mentor.id, child.id])) {
      await lockUserLifecycle(tx, userId);
    }
    relationReady();
    await relationRelease;
    await tx.user.update({ where: { id: child.id }, data: { advisorId: null } });
  }, { timeout: 15_000 });
  await relationReadyPromise;
  let mentorDeletionStarted!: () => void;
  const mentorDeletionStart = new Promise<void>((resolve) => { mentorDeletionStarted = resolve; });
  const mentorDeletion = prisma.$transaction(async (tx) => {
    mentorDeletionStarted();
    return deleteUserAccount(tx, mentor.id, {
      kind: "manual",
      actorId: admin.id,
      confirmUsername: mentor.username,
    });
  }, { timeout: 15_000 });
  await mentorDeletionStart;
  const deletionCompletedBeforeRelation = await Promise.race([
    mentorDeletion.then(() => true),
    new Promise<false>((resolve) => setTimeout(() => resolve(false), 100)),
  ]);
  releaseRelation();
  const [, mentorDeletionResult] = await Promise.all([relationWrite, mentorDeletion]);
  assert.equal(deletionCompletedBeforeRelation, false);
  assert.equal(mentorDeletionResult.deleted, true);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: child.id } })).advisorId, null);
}

async function verifyAuditExportCycleRetention(
  prisma: PrismaClient,
  admin: { id: string; displayName: string; studyDegree: StudyDegree | null; status: "ACTIVE" },
) {
  await prisma.$transaction([
    prisma.auditExportArchive.deleteMany(),
    prisma.auditExportCounter.deleteMany(),
    prisma.auditLog.deleteMany(),
  ]);
  const actor = await createMember(prisma, admin, {
    username: "integration-audit-export-actor",
    displayName: "审计归档删除学生",
    studyDegree: "DOCTOR",
    studyGrade: "DOCTOR_3",
  });
  const sourceLog = await appendAuditLog({
    userId: actor.id,
    action: "UPDATE",
    entityType: "AuditExportCycle",
  }, prisma);
  await prisma.$transaction((tx) => deleteUserAccount(tx, actor.id, {
    kind: "manual",
    actorId: admin.id,
    confirmUsername: actor.username,
  }));
  const retainedSource = await prisma.auditLog.findUniqueOrThrow({ where: { id: sourceLog.id } });
  const terminalSnapshot = retainedSource.actorSnapshot;
  assert.equal((terminalSnapshot as { accountState?: string }).accountState, "DELETED");

  const base = Date.now() + 1_000;
  for (let cycle = 1; cycle <= 4; cycle += 1) {
    await prisma.auditLog.create({
      data: {
        userId: null,
        actorSnapshot: terminalSnapshot ?? undefined,
        action: "UPDATE",
        entityType: "AuditExportCycle",
        entityId: String(cycle),
        createdAt: new Date(base + (cycle * 2 - 1) * 60_000),
      },
    });
    const result = await prisma.$transaction((tx) => executeAuditExport(
      tx,
      new Date(base + cycle * 2 * 60_000),
    ));
    assert.equal(result.seqInYear, cycle);
  }

  assert.equal(await prisma.auditLog.count(), 0);
  const archive = await prisma.auditExportArchive.findFirstOrThrow({
    where: { seqInYear: 4 },
    select: { excelData: true, rowCount: true },
  });
  assert.equal(archive.rowCount, 1);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(archive.excelData as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet("audit_logs");
  assert(sheet);
  assert.equal(sheet.getRow(2).getCell(3).value, `${actor.displayName}（账号已删除）`);
  assert.equal(sheet.getRow(2).getCell(4).value, "DELETED");
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

async function verifyProjectLeadershipLifecycleReconciliation(
  prisma: PrismaClient,
  admin: { id: string; displayName: string; studyDegree: StudyDegree | null; status: "ACTIVE" },
  mentor: { id: string; displayName: string; studyDegree: StudyDegree | null; status: "ACTIVE" },
) {
  const createLedProject = async (key: string) => {
    const leader = await createMember(prisma, admin, {
      username: `integration-leader-lifecycle-${key}`,
      displayName: `负责人生命周期-${key}`,
      studyDegree: "MASTER",
      studyGrade: "MASTER_1",
      advisorId: mentor.id,
    });
    const project = await prisma.project.create({
      data: {
        name: `integration leader lifecycle ${key}`,
        creatorId: mentor.id,
        creatorSnapshot: createActorSnapshot(mentor),
        advisorId: mentor.id,
        advisorSnapshot: createActorSnapshot(mentor),
      },
    });
    await prisma.$transaction((tx) => assignProjectLeader(tx, {
      projectId: project.id,
      leaderId: leader.id,
      actorId: admin.id,
    }));
    return { leader, project };
  };
  const assertReleased = async (
    fixture: Awaited<ReturnType<typeof createLedProject>>,
    accountState: "ACTIVE" | "SUSPENDED" | "GRADUATED",
  ) => {
    const [project, activeLeadTags] = await Promise.all([
      prisma.project.findUniqueOrThrow({ where: { id: fixture.project.id } }),
      prisma.userTag.count({
        where: { userId: fixture.leader.id, projectId: fixture.project.id, source: "PROJECT_LEAD", revokedAt: null },
      }),
    ]);
    assert.equal(project.leaderId, null);
    assert.equal(project.leaderNeedsReassignment, true);
    assert.equal(snapshot(project.leaderSnapshot).displayName, fixture.leader.displayName);
    assert.equal(snapshot(project.leaderSnapshot).accountState, accountState);
    assert.equal(activeLeadTags, 0);
  };

  const suspended = await createLedProject("suspended");
  await prisma.$transaction(async (tx) => {
    for (const userId of orderUserLifecycleLockIds([admin.id, suspended.leader.id])) {
      await lockUserLifecycle(tx, userId);
    }
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`;
    const actorSnapshot = createActorSnapshot(admin, now);
    await tx.user.update({ where: { id: suspended.leader.id }, data: { status: "SUSPENDED" } });
    await reconcileCanonicalProjectLeadershipForUser(tx, {
      userId: suspended.leader.id,
      now,
      revokedBy: { id: admin.id, snapshot: actorSnapshot },
    });
  });
  await assertReleased(suspended, "SUSPENDED");

  const graduated = await createLedProject("graduated");
  await prisma.$transaction((tx) => graduateUser(tx, { userId: graduated.leader.id, actorId: admin.id }));
  await assertReleased(graduated, "GRADUATED");

  const promoted = await createLedProject("promoted");
  await prisma.$transaction(async (tx) => {
    await lockUserAdvisorRelations(tx);
    for (const userId of orderUserLifecycleLockIds([admin.id, promoted.leader.id])) {
      await lockUserLifecycle(tx, userId);
    }
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`;
    const actorSnapshot = createActorSnapshot(admin, now);
    await applyAdminUserRoleUpdate(tx, {
      adminId: admin.id,
      userId: promoted.leader.id,
      role: "ADMIN",
      now,
      actorSnapshot,
    });
    await reconcileCanonicalProjectLeadershipForUser(tx, {
      userId: promoted.leader.id,
      now,
      revokedBy: { id: admin.id, snapshot: actorSnapshot },
    });
  });
  await assertReleased(promoted, "ACTIVE");

  const changedDegree = await createLedProject("mentor-degree");
  await prisma.$transaction((tx) => syncStudyIdentity(tx, {
    userId: changedDegree.leader.id,
    actorId: admin.id,
    role: "MEMBER",
    studyDegree: "MENTOR",
    studyGrade: null,
  }));
  await assertReleased(changedDegree, "ACTIVE");

  const movedAdvisor = await createLedProject("advisor-move");
  const replacementMentor = await createMember(prisma, admin, {
    username: "integration-replacement-mentor",
    displayName: "替代导师",
    studyDegree: "MENTOR",
    studyGrade: null,
  });
  await prisma.$transaction(async (tx) => {
    await lockUserAdvisorRelations(tx);
    for (const userId of orderUserLifecycleLockIds([
      admin.id,
      mentor.id,
      movedAdvisor.leader.id,
      replacementMentor.id,
    ])) {
      await lockUserLifecycle(tx, userId);
    }
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`;
    const actorSnapshot = createActorSnapshot(admin, now);
    await tx.user.update({
      where: { id: movedAdvisor.leader.id },
      data: {
        advisorId: replacementMentor.id,
        advisorSnapshot: createActorSnapshot(replacementMentor, now),
      },
    });
    await reconcileCanonicalProjectLeadershipForUser(tx, {
      userId: movedAdvisor.leader.id,
      now,
      revokedBy: { id: admin.id, snapshot: actorSnapshot },
    });
  });
  await assertReleased(movedAdvisor, "ACTIVE");

  await assert.rejects(
    prisma.$transaction((tx) => deleteUserAccount(tx, mentor.id, {
      kind: "manual",
      actorId: admin.id,
      confirmUsername: "integration-mentor",
    })),
    { message: ACTIVE_PROJECT_ADVISOR_RESPONSIBILITY_MESSAGE },
  );

  const recoverableProjectMentor = await createMember(prisma, admin, {
    username: "integration-recoverable-project-mentor",
    displayName: "可恢复项目导师",
    studyDegree: "MENTOR",
    studyGrade: null,
  });
  const recoverableProject = await prisma.project.create({
    data: {
      name: "integration recoverable advisor deletion guard",
      creatorId: recoverableProjectMentor.id,
      creatorSnapshot: createActorSnapshot(recoverableProjectMentor),
      advisorId: recoverableProjectMentor.id,
      advisorSnapshot: createActorSnapshot(recoverableProjectMentor),
      deletedAt: new Date(),
    },
  });
  await assert.rejects(
    prisma.$transaction((tx) => deleteUserAccount(tx, recoverableProjectMentor.id, {
      kind: "manual",
      actorId: admin.id,
      confirmUsername: recoverableProjectMentor.username,
    })),
    { message: ACTIVE_PROJECT_ADVISOR_RESPONSIBILITY_MESSAGE },
  );
  await prisma.project.delete({ where: { id: recoverableProject.id } });
  assert.equal((await prisma.$transaction((tx) => deleteUserAccount(tx, recoverableProjectMentor.id, {
    kind: "manual",
    actorId: admin.id,
    confirmUsername: recoverableProjectMentor.username,
  }))).deleted, true);

  const archivedMentor = await createMember(prisma, admin, {
    username: "integration-archived-only-mentor",
    displayName: "仅历史项目导师",
    studyDegree: "MENTOR",
    studyGrade: null,
  });
  const archivedLeader = await createMember(prisma, admin, {
    username: "integration-archived-only-leader",
    displayName: "仅历史项目负责人",
    studyDegree: "MASTER",
    studyGrade: "MASTER_1",
    advisorId: archivedMentor.id,
  });
  const archivedProject = await prisma.project.create({
    data: {
      name: "integration archived advisor deletion",
      creatorId: archivedMentor.id,
      creatorSnapshot: createActorSnapshot(archivedMentor),
      advisorId: archivedMentor.id,
      advisorSnapshot: createActorSnapshot(archivedMentor),
    },
  });
  await prisma.$transaction((tx) => assignProjectLeader(tx, {
    projectId: archivedProject.id,
    leaderId: archivedLeader.id,
    actorId: admin.id,
  }));
  await prisma.project.update({
    where: { id: archivedProject.id },
    data: { archivedAt: new Date(), leaderNeedsReassignment: false },
  });
  const archivedDeletion = await prisma.$transaction((tx) => deleteUserAccount(tx, archivedMentor.id, {
    kind: "manual",
    actorId: admin.id,
    confirmUsername: archivedMentor.username,
  }));
  assert.equal(archivedDeletion.deleted, true);
  const retainedArchivedProject = await prisma.project.findUniqueOrThrow({ where: { id: archivedProject.id } });
  assert.equal(retainedArchivedProject.advisorId, null);
  assert.equal(retainedArchivedProject.leaderId, null);
  assert.equal(retainedArchivedProject.leaderNeedsReassignment, false);
  assert.equal(snapshot(retainedArchivedProject.advisorSnapshot).accountState, "DELETED");
  assert.equal(snapshot(retainedArchivedProject.leaderSnapshot).displayName, archivedLeader.displayName);
  assert.equal(
    await prisma.userTag.count({
      where: {
        userId: archivedLeader.id,
        projectId: archivedProject.id,
        source: "PROJECT_LEAD",
        revokedAt: null,
      },
    }),
    0,
  );
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

async function verifyCleanInstall() {
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
    await verifyLifecycleLockHierarchy(prisma, admin);
    await verifyActorWriteLifecycleSerialization(prisma, admin, mentor.id);
    await verifyLifecycleAndDeletion(prisma, admin);
    await verifyProjectLeadershipLifecycleReconciliation(
      prisma,
      admin,
      { ...mentor, status: "ACTIVE" },
    );
    await verifyProjectTriggersAndLeaderSerialization(
      prisma,
      admin,
      { ...mentor, status: "ACTIVE" },
      [{ ...leaderA, status: "ACTIVE" }, { ...leaderB, status: "ACTIVE" }],
    );
    await verifyAuditExportCycleRetention(prisma, admin);

    return {
      schema,
      checks: [
        "formal migrations and seed on an isolated schema",
        "persisted progress window plus optimistic revision conflict",
        "bulk session revocation and advisor rewrites obey the global-to-user lock hierarchy",
        "actor writes, audit attribution, suspension, and backfill serialize with lifecycle deletion",
        "graduation, cancellation, 72-hour schedule, and idempotent scheduled deletion",
        "leader responsibility reconciles after suspension, graduation, promotion, degree, and advisor changes",
        "unfinished and recoverable project advisors are deletion-guarded while terminal history remains deletable",
        "historical attribution retained after scheduled/manual deletion",
        "four-cycle audit export retains deleted attribution after source-log cleanup",
        "project PLANNING/IN_PROGRESS/ARCHIVED/COMPLETED trigger priority",
        "concurrent leader assignment leaves one canonical PROJECT_LEAD projection",
        "deleted active leader becomes an explicit reassignment task",
      ],
    };
  } finally {
    await prisma?.$disconnect();
    await dropSchema(schema);
  }
}

async function main() {
  const legacyUpgrade = await verifyLegacyUpgrade();
  const cleanInstall = await verifyCleanInstall();
  console.log(JSON.stringify({
    upgradeSchema,
    legacyUpgrade,
    cleanInstall,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
