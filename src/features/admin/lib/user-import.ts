import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { StudyDegree, StudyGrade } from "@prisma/client";
import ExcelJS from "exceljs";

import { validatePasswordPolicy } from "@/shared/lib/security";
import { mapLegacyGrade } from "@/shared/lib/study-identity";

import { assertUserImportHeaders, USER_IMPORT_COLUMNS } from "./user-import-template";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 500;
export const IMPORT_PARSER_VERSION = 1;
export const IMPORT_PREVIEW_TTL_MS = 5 * 60 * 1000;

type ExcelWorkbookBuffer = Parameters<ExcelJS.Workbook["xlsx"]["load"]>[0];

export type ImportCandidate = {
  rowNumber: number;
  username: string;
  displayName: string;
  password: string;
  studentId: string | null;
  studyDegree: StudyDegree;
  studyGrade: StudyGrade | null;
};

export type ImportPreviewRow = Omit<ImportCandidate, "password">;

export type ImportPreviewTokenPayload = {
  v: number;
  digest: string;
  adminId: string;
  expiresAt: number;
};

function cellText(value: ExcelJS.CellValue) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  return String(value).trim();
}

function hasUnsafeFormula(value: ExcelJS.CellValue) {
  return Boolean(value && typeof value === "object" && ("formula" in value || "hyperlink" in value));
}

function parseStudyDegree(value: string): StudyDegree | null {
  const normalized = value.toLocaleUpperCase("en-US");
  if (normalized === "MASTER" || value === "硕士") return "MASTER";
  if (normalized === "DOCTOR" || value === "博士") return "DOCTOR";
  if (normalized === "MENTOR" || value === "导师") return "MENTOR";
  return null;
}

export function decodeUserImportWorkbook(base64: string) {
  if (!/^[A-Za-z0-9+/\r\n]+={0,2}$/.test(base64)) throw new Error("Excel 数据编码无效。");
  const normalized = base64.replace(/[\r\n]/g, "");
  if (normalized.length % 4 !== 0) throw new Error("Excel 数据编码无效。");
  const bytes = Buffer.from(normalized, "base64");
  if (bytes.toString("base64") !== normalized) throw new Error("Excel 数据编码无效。");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMPORT_BYTES) {
    throw new Error("Excel 文件必须小于 5 MiB。");
  }
  return bytes;
}

export function digestUserImportWorkbook(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function issueUserImportPreviewToken(payload: ImportPreviewTokenPayload, secret: string) {
  if (!secret) throw new Error("服务器未配置导入预览签名密钥。");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyUserImportPreviewToken(
  token: string,
  expected: Omit<ImportPreviewTokenPayload, "expiresAt">,
  now: Date,
  secret: string,
) {
  if (!secret) throw new Error("服务器未配置导入预览签名密钥。");
  const [encoded, providedSignature, extra] = token.split(".");
  if (!encoded || !providedSignature || extra) throw new Error("导入预览凭据无效，请重新预览。");
  const expectedSignature = createHmac("sha256", secret).update(encoded).digest();
  const provided = Buffer.from(providedSignature, "base64url");
  if (provided.length !== expectedSignature.length || !timingSafeEqual(provided, expectedSignature)) {
    throw new Error("导入预览凭据无效，请重新预览。");
  }

  let payload: ImportPreviewTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ImportPreviewTokenPayload;
  } catch {
    throw new Error("导入预览凭据无效，请重新预览。");
  }
  if (
    payload.v !== expected.v
    || payload.digest !== expected.digest
    || payload.adminId !== expected.adminId
    || !Number.isSafeInteger(payload.expiresAt)
    || payload.expiresAt <= now.getTime()
  ) {
    throw new Error("导入预览已失效或文件已变化，请重新预览。");
  }
  return payload;
}

export async function parseUserImportWorkbook(bytes: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelWorkbookBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Excel 文件中没有工作表。");
  assertUserImportHeaders(
    USER_IMPORT_COLUMNS.map((_, index) => cellText(worksheet.getRow(1).getCell(index + 1).value)),
  );

  const nonblankRows = Array.from({ length: Math.max(0, worksheet.rowCount - 1) }, (_, index) => index + 2)
    .filter((rowNumber) => {
      const row = worksheet.getRow(rowNumber);
      return USER_IMPORT_COLUMNS.some((_, index) => cellText(row.getCell(index + 1).value));
    });
  if (nonblankRows.length > MAX_IMPORT_ROWS) throw new Error("一次最多导入 500 行。");

  const errors: string[] = [];
  const candidates: ImportCandidate[] = [];
  for (const rowNumber of nonblankRows) {
    const row = worksheet.getRow(rowNumber);
    if (USER_IMPORT_COLUMNS.some((_, index) => hasUnsafeFormula(row.getCell(index + 1).value))) {
      errors.push(`第 ${rowNumber} 行：身份字段不能包含公式或外部链接。`);
      continue;
    }

    const username = cellText(row.getCell(1).value).toLocaleLowerCase("en-US");
    const displayName = cellText(row.getCell(2).value);
    const password = cellText(row.getCell(3).value);
    const studentId = cellText(row.getCell(4).value);
    const degreeText = cellText(row.getCell(5).value);
    const gradeText = cellText(row.getCell(6).value);
    if (!username || !displayName || !password) {
      errors.push(`第 ${rowNumber} 行：username、displayName 和 password 为必填项。`);
      continue;
    }

    const studyDegree = parseStudyDegree(degreeText);
    const mappedGrade = mapLegacyGrade(gradeText);
    const studyGrade = mappedGrade?.grade ?? null;
    if (!studyDegree || (studyDegree === "MENTOR" ? gradeText !== "" : mappedGrade?.degree !== studyDegree)) {
      errors.push(`第 ${rowNumber} 行：培养身份与年级不匹配。`);
      continue;
    }
    const passwordCheck = validatePasswordPolicy(password, [username, studentId]);
    if (!passwordCheck.ok) {
      errors.push(`第 ${rowNumber} 行：${passwordCheck.errors.join(" ")}`);
      continue;
    }
    candidates.push({
      rowNumber,
      username,
      displayName,
      password,
      studentId: studentId || null,
      studyDegree,
      studyGrade,
    });
  }

  const seenUsernames = new Map<string, number>();
  const seenStudentIds = new Map<string, number>();
  for (const candidate of candidates) {
    const previousUsernameRow = seenUsernames.get(candidate.username);
    if (previousUsernameRow) errors.push(`第 ${candidate.rowNumber} 行：username 与第 ${previousUsernameRow} 行重复。`);
    else seenUsernames.set(candidate.username, candidate.rowNumber);
    if (candidate.studentId) {
      const previousStudentRow = seenStudentIds.get(candidate.studentId);
      if (previousStudentRow) errors.push(`第 ${candidate.rowNumber} 行：studentId 与第 ${previousStudentRow} 行重复。`);
      else seenStudentIds.set(candidate.studentId, candidate.rowNumber);
    }
  }
  return { candidates, errors };
}

export function toUserImportPreviewRows(candidates: readonly ImportCandidate[]): ImportPreviewRow[] {
  return candidates.map((candidate) => ({
    rowNumber: candidate.rowNumber,
    username: candidate.username,
    displayName: candidate.displayName,
    studentId: candidate.studentId,
    studyDegree: candidate.studyDegree,
    studyGrade: candidate.studyGrade,
  }));
}
