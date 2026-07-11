"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { toActionResult } from "@/shared/lib/action-result";
import { createActorSnapshot } from "@/shared/lib/actor-snapshot";
import { auditPermissionDenied } from "@/shared/lib/audit";
import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { enrollmentDateForGrade } from "@/shared/lib/grade";
import { PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { STUDY_GRADE_LABELS } from "@/shared/lib/study-identity";
import { confirmUserImportInputSchema, importUsersInputSchema } from "@/shared/lib/validators/admin";

import { syncStudyIdentity } from "../lib/study-identity-service";
import {
  IMPORT_PARSER_VERSION,
  IMPORT_PREVIEW_TTL_MS,
  type ImportCandidate,
  type ImportPreviewRow,
  decodeUserImportWorkbook,
  digestUserImportWorkbook,
  issueUserImportPreviewToken,
  parseUserImportWorkbook,
  toUserImportPreviewRows,
  verifyUserImportPreviewToken,
} from "../lib/user-import";

export type { ImportPreviewRow } from "../lib/user-import";

export type ImportUsersPreviewResult = {
  rows: ImportPreviewRow[];
  errors: string[];
  previewToken: string | null;
  expiresAt: string | null;
};

export type ImportUsersResult = {
  created: number;
  errors: string[];
};

class ImportCommitConflictError extends Error {
  constructor(readonly rowErrors: string[]) {
    super("用户导入提交冲突");
  }
}

const importFeedbackMessages = [
  "Excel 数据编码无效。",
  "Excel 文件必须小于 5 MiB。",
  "Excel 文件中没有工作表。",
  "一次最多导入 500 行。",
  "导入预览凭据无效，请重新预览。",
  "导入预览已失效或文件已变化，请重新预览。",
] as const;

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("服务器未配置导入预览签名密钥。");
  return secret;
}

async function findDatabaseConflicts(
  candidates: readonly ImportCandidate[],
  client: Pick<Prisma.TransactionClient, "user"> = prisma,
) {
  if (candidates.length === 0) return [];
  const existing = await client.user.findMany({
    where: {
      OR: [
        { username: { in: candidates.map((candidate) => candidate.username) } },
        { studentId: { in: candidates.flatMap((candidate) => candidate.studentId ? [candidate.studentId] : []) } },
      ],
    },
    select: { username: true, studentId: true },
  });
  return candidates.flatMap((candidate) => existing.some((user) =>
    user.username === candidate.username || Boolean(candidate.studentId && user.studentId === candidate.studentId))
    ? [`第 ${candidate.rowNumber} 行：用户名或学号已存在。`]
    : []);
}

async function requireImportAdmin() {
  const admin = await requireActiveUser();
  await assertPermissionWithAudit({
    userId: admin.id,
    permission: PERMISSIONS.ADMIN_USER_MANAGE,
    entityType: "User",
  });
  return admin;
}

export async function previewUserImport(input: unknown): Promise<ImportUsersPreviewResult> {
  const admin = await requireImportAdmin();
  const data = importUsersInputSchema.parse(input);
  const bytes = decodeUserImportWorkbook(data.base64);
  const parsed = await parseUserImportWorkbook(bytes);
  const errors = [...parsed.errors, ...await findDatabaseConflicts(parsed.candidates)];
  const rows = toUserImportPreviewRows(parsed.candidates);
  if (errors.length > 0 || rows.length === 0) return { rows, errors, previewToken: null, expiresAt: null };

  const [{ now }] = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`;
  const expiresAt = new Date(now.getTime() + IMPORT_PREVIEW_TTL_MS);
  const previewToken = issueUserImportPreviewToken({
    v: IMPORT_PARSER_VERSION,
    digest: digestUserImportWorkbook(bytes),
    adminId: admin.id,
    expiresAt: expiresAt.getTime(),
  }, authSecret());
  return { rows, errors: [], previewToken, expiresAt: expiresAt.toISOString() };
}

export async function confirmUserImport(input: unknown): Promise<ImportUsersResult> {
  const admin = await requireImportAdmin();
  const data = confirmUserImportInputSchema.parse(input);
  const bytes = decodeUserImportWorkbook(data.base64);
  const [{ now }] = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`;
  const digest = digestUserImportWorkbook(bytes);
  verifyUserImportPreviewToken(
    data.previewToken,
    { v: IMPORT_PARSER_VERSION, digest, adminId: admin.id },
    now,
    authSecret(),
  );

  const parsed = await parseUserImportWorkbook(bytes);
  const errors = [...parsed.errors, ...await findDatabaseConflicts(parsed.candidates)];
  if (errors.length > 0 || parsed.candidates.length === 0) return { created: 0, errors };
  const prepared = await Promise.all(parsed.candidates.map(async (candidate) => ({
    ...candidate,
    passwordHash: await bcrypt.hash(candidate.password, 12),
  })));

  try {
    await prisma.$transaction(async (tx) => {
      const [currentAdmin, [{ transactionNow }]] = await Promise.all([
        tx.user.findFirst({
          where: { id: admin.id, role: "ADMIN", status: "ACTIVE" },
          select: { displayName: true, studyDegree: true, status: true },
        }),
        tx.$queryRaw<Array<{ transactionNow: Date }>>`SELECT transaction_timestamp() AS "transactionNow"`,
      ]);
      if (!currentAdmin) throw new PermissionDeniedError(PERMISSIONS.ADMIN_USER_MANAGE);
      const commitConflicts = await findDatabaseConflicts(prepared, tx);
      if (commitConflicts.length > 0) throw new ImportCommitConflictError(commitConflicts);
      for (const candidate of prepared) {
        const created = await tx.user.create({
          data: {
            username: candidate.username,
            displayName: candidate.displayName,
            passwordHash: candidate.passwordHash,
            studentId: candidate.studentId,
            studyDegree: candidate.studyDegree,
            studyGrade: candidate.studyGrade,
            enrollmentDate: candidate.studyGrade
              ? enrollmentDateForGrade(
                  candidate.studyDegree === "MASTER" ? "master" : "phd",
                  STUDY_GRADE_LABELS[candidate.studyGrade],
                )
              : null,
            role: "MEMBER",
            mustChangePassword: true,
          },
          select: { id: true },
        });
        await syncStudyIdentity(tx, {
          userId: created.id,
          actorId: admin.id,
          role: "MEMBER",
          studyDegree: candidate.studyDegree,
          studyGrade: candidate.studyGrade,
        });
      }
      await tx.auditLog.create({
        data: {
          userId: admin.id,
          actorSnapshot: createActorSnapshot(currentAdmin, transactionNow),
          action: "IMPORT",
          entityType: "User",
          details: {
            fileName: data.fileName,
            digest,
            parserVersion: IMPORT_PARSER_VERSION,
            created: prepared.length,
          },
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: admin.id,
        permission: error.permission,
        entityType: "User",
      });
      throw error;
    }
    if (error instanceof ImportCommitConflictError) {
      return { created: 0, errors: error.rowErrors };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && (error.code === "P2002" || error.code === "P2034")
    ) {
      const conflicts = await findDatabaseConflicts(prepared);
      return {
        created: 0,
        errors: conflicts.length > 0
          ? conflicts
          : ["提交时检测到并发冲突，整批未写入。请重新预览后再试。"],
      };
    }
    throw error;
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/tags");
  return { created: prepared.length, errors: [] };
}

export async function previewUserImportResult(input: unknown) {
  return toActionResult(() => previewUserImport(input), {
    fallbackMessage: "无法生成导入预览，请稍后重试。",
    knownMessages: importFeedbackMessages,
  });
}

export async function confirmUserImportResult(input: unknown) {
  return toActionResult(() => confirmUserImport(input), {
    fallbackMessage: "用户导入失败，请稍后重试。",
    knownMessages: importFeedbackMessages,
  });
}

// Kept as a transition alias for existing imports; confirmation still requires
// the signed preview token in the input contract.
export const importUsers = confirmUserImport;
