import ExcelJS from "exceljs";

export const USER_IMPORT_COLUMNS = [
  { key: "username", header: "username", required: true, description: "登录用户名", example: "student.demo" },
  { key: "displayName", header: "displayName", required: true, description: "姓名", example: "示例学生" },
  {
    key: "password",
    header: "password",
    required: true,
    description: "初始密码（至少 10 位，不能包含用户名或学号）",
    example: "Lab.Template.2026!",
  },
  { key: "studentId", header: "studentId", required: false, description: "学号", example: "20260001" },
  { key: "studyDegree", header: "studyDegree", required: true, description: "培养身份：硕士/博士/导师", example: "硕士" },
  { key: "studyGrade", header: "studyGrade", required: false, description: "学生年级；导师留空", example: "研1" },
] as const;

export function assertUserImportHeaders(headers: readonly string[]) {
  const expected = USER_IMPORT_COLUMNS.map((column) => column.header);
  if (headers.length < expected.length || expected.some((header, index) => headers[index] !== header)) {
    throw new Error(`Excel 表头必须依次为：${expected.join("、")}。`);
  }
}

export async function buildUserImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("成员导入");
  worksheet.columns = USER_IMPORT_COLUMNS.map((column) => ({
    header: column.header,
    key: column.key,
    width: Math.max(18, column.description.length + 6),
  }));
  worksheet.addRow(Object.fromEntries(USER_IMPORT_COLUMNS.map((column) => [column.key, column.example])));
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  return workbook.xlsx.writeBuffer();
}
