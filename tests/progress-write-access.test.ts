import assert from "node:assert/strict";
import test from "node:test";

import type { Prisma } from "@prisma/client";

import { requireProgressReportWriteAccess } from "../src/features/progress/lib/report-write";
import { PERMISSIONS, PermissionDeniedError } from "../src/shared/lib/permissions";

const now = new Date("2026-07-11T00:00:00.000Z");

function transactionWithPermissions(permissions: string[], active = true) {
  return {
    $queryRaw: async () => [{ now }],
    user: {
      findFirst: async () => active
        ? { displayName: "测试成员", studyDegree: "MASTER", status: "ACTIVE" }
        : null,
      findUnique: async () => active
        ? {
            role: "MEMBER",
            status: "ACTIVE",
            tags: [{
              projectId: null,
              expiresAt: null,
              revokedAt: null,
              tag: { name: "progress-writer", permissions, template: null },
            }],
          }
        : null,
    },
  } as unknown as Prisma.TransactionClient;
}

test("进度写入在事务内重新校验当前权限并生成数据库时刻署名", async () => {
  const access = await requireProgressReportWriteAccess(
    transactionWithPermissions([PERMISSIONS.PROGRESS_REPORT_WRITE, PERMISSIONS.PROGRESS_REPORT_SUBMIT]),
    "member-1",
    [PERMISSIONS.PROGRESS_REPORT_WRITE, PERMISSIONS.PROGRESS_REPORT_SUBMIT],
  );

  assert.equal(access.now, now);
  assert.equal(access.actorSnapshot.displayName, "测试成员");
  assert.equal(access.actorSnapshot.capturedAt, now.toISOString());
});

test("进度写入拒绝事务开始前已撤销权限或已停用账号", async () => {
  await assert.rejects(
    requireProgressReportWriteAccess(
      transactionWithPermissions([PERMISSIONS.PROGRESS_REPORT_WRITE]),
      "member-1",
      [PERMISSIONS.PROGRESS_REPORT_WRITE, PERMISSIONS.PROGRESS_REPORT_SUBMIT],
    ),
    (error) => error instanceof PermissionDeniedError
      && error.permission === PERMISSIONS.PROGRESS_REPORT_SUBMIT,
  );
  await assert.rejects(
    requireProgressReportWriteAccess(
      transactionWithPermissions([], false),
      "member-1",
      [PERMISSIONS.PROGRESS_REPORT_WRITE],
    ),
    PermissionDeniedError,
  );
});
