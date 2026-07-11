import assert from "node:assert/strict";
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
