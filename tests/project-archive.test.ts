import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PROJECT_UNARCHIVE_COOLDOWN_HOURS,
  assertProjectCanArchiveStatus,
  assertProjectCanUnarchive,
  canUnarchiveProjectAt,
  formatProjectArchiveRemaining,
  getProjectUnarchiveAvailableAt,
  getProjectUnarchiveRemainingMs,
  resolveProjectArchiveAccess,
} from "../src/features/projects/lib/archive";
import { PROJECT_REACTIVATION_ADVISOR_REQUIRED_MESSAGE } from "../src/features/projects/lib/project-responsibility";
import {
  PROJECT_ARCHIVED_WRITE_MESSAGE,
  assertProjectWritableStatus,
} from "../src/features/projects/lib/writable";
import { PERMISSIONS, computeProjectPermissionsFromSnapshot } from "../src/shared/lib/permissions";

test("项目归档允许 PLANNING 与 IN_PROGRESS，拒绝终态", () => {
  assert.doesNotThrow(() => assertProjectCanArchiveStatus("PLANNING"));
  assert.doesNotThrow(() => assertProjectCanArchiveStatus("IN_PROGRESS"));
  assert.throws(() => assertProjectCanArchiveStatus("COMPLETED"), /规划中或进行中/);
  assert.throws(() => assertProjectCanArchiveStatus("ARCHIVED"), /规划中或进行中/);
});

test("项目归档只信任 canonical leaderId 或管理员治理权限", () => {
  const none = new Set<never>();
  assert.deepEqual(
    resolveProjectArchiveAccess({
      actorId: "lead",
      actorCanLead: true,
      leaderId: "lead",
      globalPermissions: none,
      projectPermissions: none,
    }),
    { allowed: true, scope: "leader" },
  );
  assert.deepEqual(
    resolveProjectArchiveAccess({
      actorId: "admin",
      actorCanLead: false,
      leaderId: "lead",
      globalPermissions: new Set([PERMISSIONS.PROJECT_ARCHIVE_ANY]),
      projectPermissions: none,
    }),
    { allowed: true, scope: "admin" },
  );
  assert.deepEqual(
    resolveProjectArchiveAccess({
      actorId: "member",
      actorCanLead: true,
      leaderId: "lead",
      globalPermissions: none,
      projectPermissions: none,
    }),
    { allowed: false },
  );
  assert.deepEqual(
    resolveProjectArchiveAccess({
      actorId: "lead",
      actorCanLead: false,
      leaderId: "lead",
      globalPermissions: none,
      projectPermissions: none,
    }),
    { allowed: false },
  );
});

test("项目归档只接受当前项目的 project.manage", () => {
  const user = {
    role: "MEMBER" as const,
    status: "ACTIVE" as const,
    tags: [{
      projectId: "project-a",
      tag: { name: "project-manager:project-a", permissions: [PERMISSIONS.PROJECT_MANAGE] },
    }],
  };
  const matching = computeProjectPermissionsFromSnapshot(user, "project-a");
  const crossProject = computeProjectPermissionsFromSnapshot(user, "project-b");
  const input = {
    actorId: "member",
    actorCanLead: false,
    leaderId: "lead",
    globalPermissions: new Set<never>(),
  };

  assert.deepEqual(
    resolveProjectArchiveAccess({ ...input, projectPermissions: matching }),
    { allowed: true, scope: "project" },
  );
  assert.deepEqual(
    resolveProjectArchiveAccess({ ...input, projectPermissions: crossProject }),
    { allowed: false },
  );
});

test("项目反激活冷却期为 168 小时，边界到点才允许", () => {
  const archivedAt = new Date("2026-06-01T00:00:00.000Z");
  assert.equal(PROJECT_UNARCHIVE_COOLDOWN_HOURS, 168);
  assert.equal(getProjectUnarchiveAvailableAt(archivedAt).toISOString(), "2026-06-08T00:00:00.000Z");
  assert.equal(canUnarchiveProjectAt(archivedAt, new Date("2026-06-07T23:59:59.000Z")), false);
  assert.equal(canUnarchiveProjectAt(archivedAt, new Date("2026-06-08T00:00:00.000Z")), true);
  assert.equal(getProjectUnarchiveRemainingMs(archivedAt, new Date("2026-06-08T00:00:00.000Z")), 0);
});

test("项目反激活状态机应拒绝非归档或冷却未满", () => {
  const archivedAt = new Date("2026-06-01T00:00:00.000Z");
  assert.throws(() => assertProjectCanUnarchive("IN_PROGRESS", null, true), /已归档/);
  assert.throws(
    () => assertProjectCanUnarchive("ARCHIVED", archivedAt, false, new Date("2026-06-08T00:00:00.000Z")),
    { message: PROJECT_REACTIVATION_ADVISOR_REQUIRED_MESSAGE },
  );
  assert.throws(
    () => assertProjectCanUnarchive("ARCHIVED", archivedAt, true, new Date("2026-06-07T00:00:00.000Z")),
    /7 天/,
  );
  assert.doesNotThrow(
    () => assertProjectCanUnarchive("ARCHIVED", archivedAt, true, new Date("2026-06-08T00:00:00.000Z")),
  );
});

test("项目归档动作在事务内绑定具体项目权限，解档恢复负责人待分配状态", () => {
  for (const file of [
    "src/features/projects/actions/archive-project.ts",
    "src/features/projects/actions/unarchive-project.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /getProjectPermissionsForClient\(tx, user\.id, projectId, actor\.now\)/, file);
    assert.match(source, /projectPermissions,/, file);
  }

  const unarchiveSource = readFileSync("src/features/projects/actions/unarchive-project.ts", "utf8");
  assert.match(unarchiveSource, /lockProjectResponsibilityContext/);
  assert.match(unarchiveSource, /isCanonicalProjectAdvisorEligible/);
  assert.match(unarchiveSource, /leaderNeedsReassignment: leaderId === null/);

  const lifecycleSource = readFileSync("src/features/projects/actions/project-lifecycle.ts", "utf8");
  assert.match(lifecycleSource, /deletedAt: currentActor\.now, leaderNeedsReassignment: false/);
  assert.match(lifecycleSource, /lockProjectResponsibilityContext/);
  assert.match(lifecycleSource, /isCanonicalProjectAdvisorEligible/);
  assert.match(lifecycleSource, /shouldProjectRequireLeaderReassignment/);
});

test("项目详情必须解析并展示创建人、负责导师和项目负责人历史署名", () => {
  const page = readFileSync("src/app/(dashboard)/projects/[id]/page.tsx", "utf8");
  for (const relation of ["creator", "advisor", "leader"]) {
    assert.match(page, new RegExp(`resolveActorDisplay\\(project\\.${relation}, project\\.${relation}Snapshot\\)`));
  }
  assert.match(page, /projectPermissions\.has\(PERMISSIONS\.PROJECT_MANAGE\)/);

  const detail = readFileSync("src/features/projects/components/project-detail.tsx", "utf8");
  assert.match(detail, /data-project-attribution/);
  assert.match(detail, /原负责人已不再符合任职条件/);
});

test("归档项目应拒绝写操作", () => {
  assert.doesNotThrow(() => assertProjectWritableStatus("IN_PROGRESS"));
  assert.throws(() => assertProjectWritableStatus("ARCHIVED"), { message: PROJECT_ARCHIVED_WRITE_MESSAGE });
});

test("归档倒计时展示应按剩余时间分段", () => {
  assert.equal(formatProjectArchiveRemaining(2 * 86400 * 1000 + 3 * 3600 * 1000), "2天3小时");
  assert.equal(formatProjectArchiveRemaining(2 * 3600 * 1000 + 5 * 60 * 1000), "2小时5分");
  assert.equal(formatProjectArchiveRemaining(65 * 1000), "1分5秒");
  assert.equal(formatProjectArchiveRemaining(0), "0秒");
});
