import assert from "node:assert/strict";
import test from "node:test";

import {
  createActorSnapshot,
  formatActorDisplayName,
  loadActorSnapshot,
  parseActorSnapshot,
  resolveActorDisplay,
} from "../src/shared/lib/actor-snapshot";
import { isProgressReportWindowOpen } from "../src/shared/lib/date";
import { canArchiveProjectStatus, deriveProjectStatus } from "../src/shared/lib/project-status";
import {
  assertStudyIdentity,
  isStudyGradeForDegree,
  mapLegacyGrade,
  studyDegreeTagName,
} from "../src/shared/lib/study-identity";
import { assertRuntimeSettings } from "../src/shared/lib/system-settings";

test("旧年级映射只接受行动书列出的九个精确值", () => {
  assert.deepEqual(mapLegacyGrade("研0"), { degree: "MASTER", grade: "MASTER_0" });
  assert.deepEqual(mapLegacyGrade("研3"), { degree: "MASTER", grade: "MASTER_3" });
  assert.deepEqual(mapLegacyGrade("博1"), { degree: "DOCTOR", grade: "DOCTOR_1" });
  assert.deepEqual(mapLegacyGrade("博5"), { degree: "DOCTOR", grade: "DOCTOR_5" });
  for (const value of [null, "", "   ", "2026级", "本科4"]) assert.equal(mapLegacyGrade(value), null);
});

test("培养身份与年级组合由一个规范校验器裁决", () => {
  assert.equal(isStudyGradeForDegree("MASTER", "MASTER_2"), true);
  assert.equal(isStudyGradeForDegree("DOCTOR", "MASTER_2"), false);
  assert.equal(isStudyGradeForDegree("MENTOR", null), true);
  assert.doesNotThrow(() => assertStudyIdentity({ role: "MEMBER", studyDegree: "MENTOR", studyGrade: null }));
  assert.throws(
    () => assertStudyIdentity({ role: "MEMBER", studyDegree: "MENTOR", studyGrade: "MASTER_1" }),
    /导师不能设置年级/,
  );
  assert.throws(
    () => assertStudyIdentity({ role: "ADMIN", studyDegree: "MASTER", studyGrade: "MASTER_1" }),
    /管理员账号不能设置/,
  );
  assert.equal(studyDegreeTagName("MASTER"), "grad-master");
  assert.equal(studyDegreeTagName("DOCTOR"), "grad-phd");
  assert.equal(studyDegreeTagName("MENTOR"), "advisor");
});

test("项目状态只由归档、完成和有效节点数推导", () => {
  assert.equal(deriveProjectStatus({ archivedAt: new Date(), currentStatus: "REVIEW", activeNodeCount: 8 }), "ARCHIVED");
  assert.equal(deriveProjectStatus({ archivedAt: null, currentStatus: "COMPLETED", activeNodeCount: 0 }), "COMPLETED");
  assert.equal(deriveProjectStatus({ archivedAt: null, currentStatus: "REVIEW", activeNodeCount: 0 }), "PLANNING");
  assert.equal(deriveProjectStatus({ archivedAt: null, currentStatus: "REVIEW", activeNodeCount: 1 }), "IN_PROGRESS");
  assert.equal(canArchiveProjectStatus("PLANNING"), true);
  assert.equal(canArchiveProjectStatus("IN_PROGRESS"), true);
  assert.equal(canArchiveProjectStatus("COMPLETED"), false);
});

test("署名快照有版本、隐私边界和损坏回退", () => {
  const capturedAt = new Date("2026-07-10T00:00:00.000Z");
  const snapshot = createActorSnapshot(
    { displayName: "张同学", studyDegree: "MASTER", status: "ACTIVE" },
    capturedAt,
    "DELETED",
  );
  assert.deepEqual(parseActorSnapshot(snapshot), snapshot);
  assert.equal(Object.hasOwn(snapshot, "username"), false);
  assert.deepEqual(resolveActorDisplay(null, snapshot), {
    displayName: "张同学",
    studyDegree: "MASTER",
    accountState: "DELETED",
    isDeleted: true,
  });
  assert.equal(resolveActorDisplay(null, { v: 99 }).displayName, "已删除用户");
  assert.equal(resolveActorDisplay({ displayName: "实时姓名", studyDegree: "DOCTOR", status: "ACTIVE" }, snapshot).displayName, "实时姓名");
  assert.equal(formatActorDisplayName(resolveActorDisplay(null, snapshot)), "张同学（账号已删除）");
  assert.equal(
    formatActorDisplayName(resolveActorDisplay(null, { ...snapshot, accountState: "GRADUATED" })),
    "张同学（已毕业）",
  );
  assert.equal(
    formatActorDisplayName(resolveActorDisplay({ displayName: "暂停用户", status: "SUSPENDED" }, null)),
    "暂停用户（已停用）",
  );
});

test("署名快照加载器只读取有界公开身份字段", async () => {
  const capturedAt = new Date("2026-07-10T00:00:00.000Z");
  const client = {
    user: {
      findUnique: async () => ({ displayName: "审计操作者", studyDegree: "MENTOR" as const, status: "ACTIVE" as const }),
    },
  } as unknown as Parameters<typeof loadActorSnapshot>[0];

  assert.deepEqual(await loadActorSnapshot(client, "actor-id", capturedAt), {
    v: 1,
    displayName: "审计操作者",
    studyDegree: "MENTOR",
    accountState: "ACTIVE",
    capturedAt: capturedAt.toISOString(),
  });
});

test("持久化窗口按上海日和分钟边界生效", () => {
  const window = {
    progressStartDay: 10,
    progressStartMinute: 8 * 60 + 30,
    progressEndDay: 12,
    progressEndMinute: 17 * 60,
  };
  assert.equal(isProgressReportWindowOpen(new Date("2026-07-10T00:29:00.000Z"), window), false);
  assert.equal(isProgressReportWindowOpen(new Date("2026-07-10T00:30:00.000Z"), window), true);
  assert.equal(isProgressReportWindowOpen(new Date("2026-07-12T09:00:00.000Z"), window), true);
  assert.equal(isProgressReportWindowOpen(new Date("2026-07-12T09:01:00.000Z"), window), false);
  assert.doesNotThrow(() => assertRuntimeSettings({ ...window, sessionHours: 24 }));
  assert.throws(() => assertRuntimeSettings({ ...window, progressEndDay: 10, progressEndMinute: 8 * 60 + 30, sessionHours: 24 }), /晚于/);
  assert.throws(() => assertRuntimeSettings({ ...window, sessionHours: 721 }), /1 到 720/);
});
