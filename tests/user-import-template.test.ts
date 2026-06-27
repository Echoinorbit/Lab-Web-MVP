import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import {
  USER_IMPORT_COLUMNS,
  buildUserImportTemplate,
} from "../src/features/admin/lib/user-import-template";

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
