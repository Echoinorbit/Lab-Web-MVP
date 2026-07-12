import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

import {
  buildAuditExportContentDisposition,
  buildAuditExportPlan,
  buildAuditWorkbookBuffer,
  formatShanghaiDateForFileName,
  getShanghaiYearEnd,
  isAuditCronAuthorized,
  resolveAuditExportRangeStart,
} from "../src/features/admin/lib/audit-export";

test("审计导出 cron 鉴权仅支持 Bearer secret 且拒绝 query token 兼容路径", () => {
  assert.equal(isAuditCronAuthorized({ authorizationHeader: "Bearer s1", secret: "s1" }), true);
  assert.equal(isAuditCronAuthorized({ authorizationHeader: "Bearer wrong", secret: "s1" }), false);
  assert.equal(isAuditCronAuthorized({ authorizationHeader: "Bearer longer", secret: "s1" }), false);
  assert.equal(isAuditCronAuthorized({ authorizationHeader: "s1", secret: "s1" }), false);
  assert.equal(isAuditCronAuthorized({ authorizationHeader: "Bearer s1", secret: "" }), false);
});

test("审计导出下载文件名应使用 RFC 5987 filename* 编码", () => {
  assert.equal(
    buildAuditExportContentDisposition("审计 export.xlsx"),
    "attachment; filename*=UTF-8''%E5%AE%A1%E8%AE%A1%20export.xlsx",
  );
});

test("审计导出文件名应按上海日期生成", () => {
  assert.equal(formatShanghaiDateForFileName(new Date("2026-06-24T16:30:00.000Z")), "2026-06-25");
});

test("审计导出区间应连续衔接上一轮 rangeEnd，首次回退到最早日志", () => {
  const now = new Date("2026-06-25T07:00:00.000Z");
  const previousRangeEnd = new Date("2026-06-20T00:00:00.000Z");
  const earliestLogCreatedAt = new Date("2026-06-18T00:00:00.000Z");

  assert.equal(
    resolveAuditExportRangeStart({ previousRangeEnd, earliestLogCreatedAt, now }).toISOString(),
    previousRangeEnd.toISOString(),
  );
  assert.equal(
    resolveAuditExportRangeStart({ earliestLogCreatedAt, now }).toISOString(),
    earliestLogCreatedAt.toISOString(),
  );
  assert.equal(resolveAuditExportRangeStart({ now }).toISOString(), now.toISOString());
});

test("审计导出计划应递增 seq 与 cycle，并在第 4 次触发清库归零", () => {
  const now = new Date("2026-06-25T07:00:00.000Z");
  const rangeStart = new Date("2026-06-18T00:00:00.000Z");
  const rangeEnd = now;

  assert.deepEqual(
    buildAuditExportPlan({
      counter: { exportsInYear: 1, cycleCount: 1 },
      rangeStart,
      rangeEnd,
      now,
    }),
    {
      year: 2026,
      rangeStart,
      rangeEnd,
      seqInYear: 2,
      fileName: "audit_export_2026-06-25_seq2.xlsx",
      expiresAt: getShanghaiYearEnd(2026),
      exportsInYear: 2,
      cycleCount: 2,
      shouldClearAuditLogs: false,
    },
  );

  const fourth = buildAuditExportPlan({
    counter: { exportsInYear: 3, cycleCount: 3 },
    rangeStart,
    rangeEnd,
    now,
  });
  assert.equal(fourth.seqInYear, 4);
  assert.equal(fourth.cycleCount, 0);
  assert.equal(fourth.shouldClearAuditLogs, true);
});

test("审计导出归档到期时间应为上海自然年年底", () => {
  assert.equal(getShanghaiYearEnd(2026).toISOString(), "2026-12-31T15:59:59.999Z");
});

test("审计归档在源日志清理后仍保留历史操作者姓名与账号状态", async () => {
  const buffer = await buildAuditWorkbookBuffer([{
    createdAt: new Date("2026-07-10T00:00:00.000Z"),
    userId: null,
    actorName: "张三（已毕业）",
    actorState: "GRADUATED",
    action: "DELETE",
    entityType: "User",
    entityId: "student-1",
    ipAddress: null,
    details: { retained: true },
  }]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet("audit_logs");
  assert.ok(sheet);
  assert.deepEqual((sheet.getRow(1).values as unknown[]).slice(1), [
    "createdAt",
    "userId",
    "actorName",
    "actorState",
    "action",
    "entityType",
    "entityId",
    "ipAddress",
    "details",
  ]);
  assert.equal(sheet.getRow(2).getCell(3).value, "张三（已毕业）");
  assert.equal(sheet.getRow(2).getCell(4).value, "GRADUATED");
});
