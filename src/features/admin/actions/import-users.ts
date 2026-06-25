"use server";

import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";

import { appendAuditLog } from "@/shared/lib/audit";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { defaultEnrollmentDate } from "@/shared/lib/grade";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { validatePasswordPolicy } from "@/shared/lib/security";
import { requireActiveUser } from "@/shared/lib/session";
import { importUsersInputSchema } from "@/shared/lib/validators/admin";

export type ImportUsersResult = {
  created: number;
  errors: string[];
};

type ExcelWorkbookBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

function cellText(value: ExcelJS.CellValue) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  return String(value).trim();
}

export async function importUsers(input: unknown): Promise<ImportUsersResult> {
  const admin = await requireActiveUser();
  const data = importUsersInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(data.base64, "base64") as unknown as ExcelWorkbookBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Excel file has no worksheet.");

  let created = 0;
  const errors: string[] = [];
  const now = new Date();

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const username = cellText(row.getCell(1).value);
    const displayName = cellText(row.getCell(2).value);
    const password = cellText(row.getCell(3).value);
    const studentId = cellText(row.getCell(4).value);
    const grade = cellText(row.getCell(5).value);

    if (!username && !displayName && !password) continue;
    if (!username || !displayName || !password) {
      errors.push(`Row ${rowNumber}: username, displayName and password are required.`);
      continue;
    }

    const passwordCheck = validatePasswordPolicy(password, [username, studentId]);
    if (!passwordCheck.ok) {
      errors.push(`Row ${rowNumber}: ${passwordCheck.errors.join(" ")}`);
      continue;
    }

    try {
      await prisma.user.create({
        data: {
          username,
          displayName,
          passwordHash: await bcrypt.hash(password, 12),
          studentId: studentId || null,
          grade: grade || null,
          enrollmentDate: defaultEnrollmentDate(now),
          role: "MEMBER",
          mustChangePassword: true,
        },
      });
      created += 1;
    } catch {
      errors.push(`Row ${rowNumber}: failed to create user ${username}.`);
    }
  }

  await appendAuditLog({
    userId: admin.id,
    action: "IMPORT",
    entityType: "User",
    details: {
      fileName: data.fileName,
      created,
      errorCount: errors.length,
    },
  });

  revalidatePath("/admin/users");
  return { created, errors };
}
