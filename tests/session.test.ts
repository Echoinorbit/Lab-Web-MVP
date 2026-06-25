import assert from "node:assert/strict";
import test from "node:test";

import { graduateUserAccount, shouldGraduateByComputedGrade, type GraduationTransaction } from "../src/shared/lib/graduation";
import { isSessionCurrent } from "../src/shared/lib/session";
import { resolveSessionStatus } from "../src/shared/lib/user-status";

test("仅当用户存在、处于激活状态且 tokenVersion 一致时，会话才视为有效", () => {
  assert.equal(isSessionCurrent({ tokenVersion: 2 }, { status: "ACTIVE", tokenVersion: 2 }), true);
  assert.equal(isSessionCurrent({ tokenVersion: 2 }, { status: "ACTIVE", tokenVersion: 3 }), false);
  assert.equal(isSessionCurrent({ tokenVersion: 2 }, { status: "SUSPENDED", tokenVersion: 2 }), false);
  assert.equal(isSessionCurrent({ tokenVersion: 2 }, { status: "GRADUATED", tokenVersion: 2 }), false);
  assert.equal(isSessionCurrent({ tokenVersion: 2 }, null), false);
});

test("会话状态应保留已毕业语义但仍将失效会话视为不可用", () => {
  assert.equal(resolveSessionStatus("ACTIVE", true), "ACTIVE");
  assert.equal(resolveSessionStatus("ACTIVE", false), "SUSPENDED");
  assert.equal(resolveSessionStatus("SUSPENDED", false), "SUSPENDED");
  assert.equal(resolveSessionStatus("GRADUATED", false), "GRADUATED");
  assert.equal(resolveSessionStatus(null, false), "SUSPENDED");
});

test("处于毕业年限的活跃用户应被毕业协调识别", () => {
  const now = new Date("2025-08-31T16:00:00.000Z");
  assert.equal(
    shouldGraduateByComputedGrade(
      {
        status: "ACTIVE",
        enrollmentDate: "2021-08-31T16:00:00.000Z",
        tags: [{ projectId: null, tag: { name: "grad-master" } }],
      },
      now,
    ),
    true,
  );
  assert.equal(
    shouldGraduateByComputedGrade(
      {
        status: "SUSPENDED",
        enrollmentDate: "2021-08-31T16:00:00.000Z",
        tags: [{ projectId: null, tag: { name: "grad-master" } }],
      },
      now,
    ),
    false,
  );
});

test("毕业协调应置为已毕业、吊销会话并撤销有效 Tag", async () => {
  const userUpdates: Parameters<GraduationTransaction["user"]["updateMany"]>[0][] = [];
  const tagUpdates: Parameters<GraduationTransaction["userTag"]["updateMany"]>[0][] = [];
  const tx: GraduationTransaction = {
    user: {
      updateMany: async (args) => {
        userUpdates.push(args);
        return { count: 1 };
      },
    },
    userTag: {
      updateMany: async (args) => {
        tagUpdates.push(args);
        return { count: 2 };
      },
    },
  };

  await graduateUserAccount(tx, "u1", new Date("2026-06-25T00:00:00.000Z"));

  assert.deepEqual(userUpdates[0], {
    where: { id: "u1", status: { not: "GRADUATED" } },
    data: { status: "GRADUATED", tokenVersion: { increment: 1 } },
  });
  assert.equal(tagUpdates[0]?.where.userId, "u1");
  assert.equal(tagUpdates[0]?.where.revokedAt, null);
  assert.equal(tagUpdates[0]?.data.revokedAt.toISOString(), "2026-06-25T00:00:00.000Z");
});
