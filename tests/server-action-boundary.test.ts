import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { redirect } from "next/navigation";

import nextConfig, { SERVER_ACTION_BODY_SIZE_LIMIT } from "../next.config";
import { toActionResult } from "@/shared/lib/action-result";

function parseMiB(value: string) {
  const match = /^(\d+)mb$/i.exec(value);
  assert.ok(match, "Server Action bodySizeLimit must use an explicit MiB value");
  return Number(match[1]) * 1024 * 1024;
}

test("Server Actions accept a 5 MiB workbook after base64 encoding and transport overhead", () => {
  const configured = nextConfig.experimental?.serverActions?.bodySizeLimit;
  assert.equal(configured, SERVER_ACTION_BODY_SIZE_LIMIT);

  const workbookBase64Bytes = Math.ceil((5 * 1024 * 1024) / 3) * 4;
  const avatarBase64Bytes = Math.ceil((2 * 1024 * 1024) / 3) * 4;
  const limitBytes = parseMiB(SERVER_ACTION_BODY_SIZE_LIMIT);
  assert.ok(limitBytes >= workbookBase64Bytes + 1024 * 1024);
  assert.ok(limitBytes >= avatarBase64Bytes + 1024 * 1024);
});

test("structured action results pass through only explicitly allowed messages", async () => {
  const known = await toActionResult(
    async () => { throw new Error("项目状态已变化，请刷新后重试。"); },
    { fallbackMessage: "项目操作失败，请稍后重试。", knownMessages: ["项目状态已变化，请刷新后重试。"] },
  );
  assert.deepEqual(known, { ok: false, message: "项目状态已变化，请刷新后重试。" });

  const internal = await toActionResult(
    async () => { throw new Error("Prisma query details"); },
    { fallbackMessage: "项目操作失败，请稍后重试。" },
  );
  assert.deepEqual(internal, { ok: false, message: "项目操作失败，请稍后重试。" });
});

test("structured action results rethrow Next redirects", async () => {
  await assert.rejects(
    () => toActionResult(async () => redirect("/login"), { fallbackMessage: "不应返回" }),
    (error: unknown) => error instanceof Error
      && "digest" in error
      && String(error.digest).startsWith("NEXT_REDIRECT"),
  );
});

test("头像替换和账号删除必须显式返回文件清理状态", () => {
  for (const file of [
    "src/features/profile/actions/update-avatar.ts",
    "src/features/admin/actions/delete-user-account.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /removeManagedAvatar\([^;]+\.catch\(\(\) => undefined\)/s);
    assert.match(source, /CleanupPending|cleanupPending/);
  }
});

test("表单动作不得把任意服务端异常原文返回给用户", () => {
  const actionFiles = readdirSync("src/features", { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.parentPath.endsWith("/actions") && entry.name.endsWith(".ts"))
    .map((entry) => `${entry.parentPath}/${entry.name}`);

  assert.ok(actionFiles.length > 0);
  for (const file of actionFiles) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /error instanceof Error \? error\.message/);
  }
});

test("审计和补填写入必须与用户生命周期锁串行化并保留终态归因", () => {
  const auditSource = readFileSync("src/shared/lib/audit.ts", "utf8");
  assert.match(auditSource, /client\.\$transaction/);
  assert.match(auditSource, /getLockedActor/);
  assert.match(auditSource, /terminalActorSnapshot/);
  assert.match(auditSource, /action: "DELETE", entityType: "User", entityId: userId/);
  assert.match(auditSource, /无法为不存在的用户保留审计归因/);
  assert.doesNotMatch(auditSource, /loadActorSnapshot/);

  const backfillSource = readFileSync("src/features/progress/lib/backfill.ts", "utf8");
  assert.match(backfillSource, /orderUserLifecycleLockIds\(\[input\.managerId, input\.userId\]\)/);
  assert.match(backfillSource, /getLockedActiveActor/);
});

test("批量会话吊销与导师关系写入必须先取得全局锁再锁用户", () => {
  const settingsSource = readFileSync("src/features/admin/actions/update-system-settings.ts", "utf8");
  const allUsersLockIndex = settingsSource.indexOf("lockAllUserLifecycles(tx)");
  const settingsActorLockIndex = settingsSource.indexOf("getLockedActiveActor(tx");
  assert.ok(allUsersLockIndex >= 0 && allUsersLockIndex < settingsActorLockIndex);

  for (const file of [
    "src/features/admin/actions/create-user.ts",
    "src/features/admin/actions/update-user-advisor.ts",
    "src/features/admin/actions/update-user-role.ts",
    "src/features/admin/actions/update-user-status.ts",
    "src/features/admin/actions/update-user-study-identity.ts",
    "src/features/admin/lib/delete-user-account.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    const relationLockIndex = source.indexOf("lockUserAdvisorRelations(tx)");
    const userLockOrderIndex = source.indexOf("for (const userId of orderUserLifecycleLockIds(");
    assert.ok(relationLockIndex >= 0 && relationLockIndex < userLockOrderIndex, file);
  }

  const deletionSource = readFileSync("src/features/admin/lib/delete-user-account.ts", "utf8");
  assert.match(deletionSource, /getProjectAdvisorLifecycleUserIds\(tx, targetUserId\)/);
  const responsibilitySource = readFileSync("src/features/projects/lib/project-responsibility.ts", "utf8");
  assert.match(responsibilitySource, /where: \{ advisorId \}/);
  assert.match(responsibilitySource, /where: \{ advisorId, leaderId: \{ not: null \} \}/);
});
