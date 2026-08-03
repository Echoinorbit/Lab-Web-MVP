import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { resolveAuditUserEntity } from "@/features/admin";

const deletedTarget = {
  v: 1,
  displayName: "历史成员",
  studyDegree: "MASTER",
  accountState: "DELETED",
  capturedAt: "2026-07-16T10:00:00.000Z",
} as const;

describe("audit entity display", () => {
  it("prefers a live target user and exposes display name plus username", () => {
    assert.deepEqual(resolveAuditUserEntity({
      entityType: "User",
      entityId: "user-live",
      liveUser: { displayName: "林澈", username: "linche", status: "ACTIVE" },
      details: {
        reason: "ADMIN_PERMANENT_DELETE",
        target: deletedTarget,
      },
    }), {
      displayName: "林澈",
      username: "linche",
    });
  });

  it("uses a validated terminal target snapshot after deletion", () => {
    assert.deepEqual(resolveAuditUserEntity({
      entityType: "User",
      entityId: "user-deleted",
      details: {
        reason: "ADMIN_PERMANENT_DELETE",
        target: deletedTarget,
      },
    }), {
      displayName: "历史成员（账号已删除）",
    });
  });

  it("rejects snapshots with an unrelated reason", () => {
    assert.equal(resolveAuditUserEntity({
      entityType: "User",
      entityId: "user-deleted",
      details: { reason: "STATUS_CHANGE", target: deletedTarget },
    }), undefined);
  });

  it("rejects nonterminal target snapshots", () => {
    assert.equal(resolveAuditUserEntity({
      entityType: "User",
      entityId: "user-active",
      details: {
        reason: "ADMIN_PERMANENT_DELETE",
        target: { ...deletedTarget, accountState: "ACTIVE" },
      },
    }), undefined);
  });

  it("never treats the actor snapshot as target identity", () => {
    assert.equal(resolveAuditUserEntity({
      entityType: "User",
      entityId: "user-missing",
      details: { actorSnapshot: deletedTarget },
    }), undefined);
  });

  it("returns no friendly identity for non-user entities or a missing id", () => {
    assert.equal(resolveAuditUserEntity({
      entityType: "Project",
      entityId: "project-1",
      liveUser: { displayName: "错误目标", username: "wrong", status: "ACTIVE" },
    }), undefined);
    assert.equal(resolveAuditUserEntity({ entityType: "User" }), undefined);
  });

  it("batches actor and target lookups while retaining the raw entity id", () => {
    const page = readFileSync("src/app/(dashboard)/admin/audit/page.tsx", "utf8");
    const table = readFileSync("src/features/admin/components/audit-log-table.tsx", "utf8");
    assert.equal(page.match(/prisma\.user\.findMany/g)?.length, 1);
    assert.match(page, /row\.entityType === "User" \? row\.entityId : null/);
    assert.match(page, /new Set\(rows\.flatMap/);
    assert.match(table, /@\{row\.entityUser\.username\}/);
    assert.match(table, /row\.entityId \?\? "—"/);
  });
});
