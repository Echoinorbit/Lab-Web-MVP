import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import {
  USER_IMPORT_COLUMNS,
  buildUserImportTemplate,
} from "../src/features/admin/lib/user-import-template";
import {
  IMPORT_PARSER_VERSION,
  MAX_IMPORT_BYTES,
  decodeUserImportWorkbook,
  digestUserImportWorkbook,
  issueUserImportPreviewToken,
  parseUserImportWorkbook,
  toUserImportPreviewRows,
  verifyUserImportPreviewToken,
} from "../src/features/admin/lib/user-import";

async function buildWorkbook(rows: readonly (readonly ExcelJS.CellValue[])[]) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("成员导入");
  worksheet.addRow(USER_IMPORT_COLUMNS.map((column) => column.header));
  for (const row of rows) worksheet.addRow([...row]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("用户导入模板列顺序应与解析器契约一致", async () => {
  const buffer = await buildUserImportTemplate();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  assert.ok(worksheet);
  assert.deepEqual(
    USER_IMPORT_COLUMNS.map((_, index) => worksheet.getRow(1).getCell(index + 1).text),
    USER_IMPORT_COLUMNS.map((column) => column.header),
  );
  assert.equal(worksheet.getCell("A2").text.length > 0, true);
  assert.equal(worksheet.getCell("C2").text.includes(worksheet.getCell("D2").text), false);
});

test("导入解析器规范化硕博导师身份且预览不返回密码", async () => {
  const bytes = await buildWorkbook([
    ["MASTER.ONE", "硕士一", "Safe.Pass.2026!", "S-001", "硕士", "研1"],
    ["doctor.one", "博士一", "Strong.Pass.2026!", "D-001", "DOCTOR", "博5"],
    ["mentor.one", "导师一", "Mentor.Pass.2026!", "", "导师", ""],
  ]);
  const parsed = await parseUserImportWorkbook(bytes);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(toUserImportPreviewRows(parsed.candidates), [
    {
      rowNumber: 2,
      username: "master.one",
      displayName: "硕士一",
      studentId: "S-001",
      studyDegree: "MASTER",
      studyGrade: "MASTER_1",
    },
    {
      rowNumber: 3,
      username: "doctor.one",
      displayName: "博士一",
      studentId: "D-001",
      studyDegree: "DOCTOR",
      studyGrade: "DOCTOR_5",
    },
    {
      rowNumber: 4,
      username: "mentor.one",
      displayName: "导师一",
      studentId: null,
      studyDegree: "MENTOR",
      studyGrade: null,
    },
  ]);
  assert.equal(Object.hasOwn(toUserImportPreviewRows(parsed.candidates)[0]!, "password"), false);
});

test("导入解析器逐行报告重复、导师年级和公式错误", async () => {
  const bytes = await buildWorkbook([
    ["duplicate", "学生一", "Safe.Pass.2026!", "S-001", "硕士", "研1"],
    ["duplicate", "学生二", "Other.Pass.2026!", "S-002", "硕士", "研2"],
    ["mentor", "导师", "Mentor.Pass.2026!", "", "导师", "博1"],
    [{ formula: "LOWER(\"formula-user\")", result: "formula-user" }, "公式", "Formula.Pass.2026!", "S-003", "硕士", "研1"],
  ]);
  const parsed = await parseUserImportWorkbook(bytes);
  assert.equal(parsed.errors.some((error) => error.includes("第 3 行") && error.includes("重复")), true);
  assert.equal(parsed.errors.some((error) => error.includes("第 4 行") && error.includes("不匹配")), true);
  assert.equal(parsed.errors.some((error) => error.includes("第 5 行") && error.includes("公式或外部链接")), true);
});

test("导入解析器限制 500 行与 5 MiB", async () => {
  const rows = Array.from({ length: 501 }, (_, index) => [
    `user-${index}`,
    `成员 ${index}`,
    `Safe.Pass.${String(index).padStart(4, "0")}!`,
    `S-${index}`,
    "硕士",
    "研1",
  ] as const);
  const bytes = await buildWorkbook(rows);
  await assert.rejects(() => parseUserImportWorkbook(bytes), /最多导入 500 行/);
  assert.throws(
    () => decodeUserImportWorkbook(Buffer.alloc(MAX_IMPORT_BYTES + 1).toString("base64")),
    /小于 5 MiB/,
  );
});

test("导入预览 HMAC 绑定文件、管理员、解析器版本和绝对到期时间", () => {
  const secret = "test-import-secret";
  const now = new Date("2026-07-10T00:00:00.000Z");
  const digest = digestUserImportWorkbook(Buffer.from("workbook-a"));
  const payload = {
    v: IMPORT_PARSER_VERSION,
    digest,
    adminId: "admin-a",
    expiresAt: now.getTime() + 60_000,
  };
  const token = issueUserImportPreviewToken(payload, secret);
  assert.deepEqual(
    verifyUserImportPreviewToken(token, {
      v: IMPORT_PARSER_VERSION,
      digest,
      adminId: "admin-a",
    }, now, secret),
    payload,
  );
  assert.throws(() => verifyUserImportPreviewToken(token, {
    v: IMPORT_PARSER_VERSION,
    digest: digestUserImportWorkbook(Buffer.from("workbook-b")),
    adminId: "admin-a",
  }, now, secret), /文件已变化/);
  assert.throws(() => verifyUserImportPreviewToken(token, {
    v: IMPORT_PARSER_VERSION,
    digest,
    adminId: "admin-b",
  }, now, secret), /已失效/);
  assert.throws(() => verifyUserImportPreviewToken(token, {
    v: IMPORT_PARSER_VERSION + 1,
    digest,
    adminId: "admin-a",
  }, now, secret), /已失效/);
  assert.throws(() => verifyUserImportPreviewToken(token, {
    v: IMPORT_PARSER_VERSION,
    digest,
    adminId: "admin-a",
  }, new Date(payload.expiresAt), secret), /已失效/);
  assert.throws(() => verifyUserImportPreviewToken(token, {
    v: IMPORT_PARSER_VERSION,
    digest,
    adminId: "admin-a",
  }, now, "wrong-secret"), /凭据无效/);
});
