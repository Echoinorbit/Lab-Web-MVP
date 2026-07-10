BEGIN;

-- Expand: typed identity, attribution fallbacks, canonical project ownership,
-- lifecycle scheduling, and persisted runtime settings.
CREATE TYPE "StudyDegree" AS ENUM ('MASTER', 'DOCTOR', 'MENTOR');
CREATE TYPE "StudyGrade" AS ENUM (
  'MASTER_0', 'MASTER_1', 'MASTER_2', 'MASTER_3',
  'DOCTOR_1', 'DOCTOR_2', 'DOCTOR_3', 'DOCTOR_4', 'DOCTOR_5'
);
CREATE TYPE "UserTagSource" AS ENUM ('MANUAL', 'LEGACY', 'STUDY_IDENTITY', 'PROJECT_LEAD');

ALTER TABLE "Announcement" DROP CONSTRAINT "Announcement_authorId_fkey";
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_authorId_fkey";
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";
ALTER TABLE "ProgressReport" DROP CONSTRAINT "ProgressReport_userId_fkey";
ALTER TABLE "Project" DROP CONSTRAINT "Project_advisorId_fkey";
ALTER TABLE "Project" DROP CONSTRAINT "Project_creatorId_fkey";
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_userId_fkey";
ALTER TABLE "ProjectNode" DROP CONSTRAINT "ProjectNode_authorId_fkey";
ALTER TABLE "User" DROP CONSTRAINT "User_advisorId_fkey";
ALTER TABLE "UserTag" DROP CONSTRAINT "UserTag_grantedById_fkey";
ALTER TABLE "UserTag" DROP CONSTRAINT "UserTag_userId_fkey";

ALTER TABLE "Announcement"
  ADD COLUMN "authorSnapshot" JSONB,
  ALTER COLUMN "authorId" DROP NOT NULL;

ALTER TABLE "AuditLog" ADD COLUMN "actorSnapshot" JSONB;

ALTER TABLE "Comment"
  ADD COLUMN "authorSnapshot" JSONB,
  ALTER COLUMN "authorId" DROP NOT NULL;

ALTER TABLE "Notification" ADD COLUMN "senderSnapshot" JSONB;

ALTER TABLE "Post"
  ADD COLUMN "authorSnapshot" JSONB,
  ALTER COLUMN "authorId" DROP NOT NULL;

ALTER TABLE "ProgressReport"
  ADD COLUMN "userSnapshot" JSONB,
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "Project"
  ADD COLUMN "advisorSnapshot" JSONB,
  ADD COLUMN "archivedById" TEXT,
  ADD COLUMN "archivedBySnapshot" JSONB,
  ADD COLUMN "creatorSnapshot" JSONB,
  ADD COLUMN "leaderId" TEXT,
  ADD COLUMN "leaderNeedsReassignment" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "leaderSnapshot" JSONB,
  ALTER COLUMN "creatorId" DROP NOT NULL;

ALTER TABLE "ProjectMember"
  ADD COLUMN "memberSnapshot" JSONB,
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "ProjectNode"
  ADD COLUMN "authorSnapshot" JSONB,
  ALTER COLUMN "authorId" DROP NOT NULL;

ALTER TABLE "User" RENAME COLUMN "grade" TO "legacyGrade";
ALTER TABLE "User"
  ADD COLUMN "advisorSnapshot" JSONB,
  ADD COLUMN "graduatedAt" TIMESTAMP(3),
  ADD COLUMN "identityMigrationNote" TEXT,
  ADD COLUMN "identityNeedsReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "scheduledDeletionAt" TIMESTAMP(3),
  ADD COLUMN "studyDegree" "StudyDegree",
  ADD COLUMN "studyGrade" "StudyGrade";

ALTER TABLE "UserTag"
  ADD COLUMN "granterSnapshot" JSONB,
  ADD COLUMN "revokerSnapshot" JSONB,
  ADD COLUMN "source" "UserTagSource" NOT NULL DEFAULT 'MANUAL',
  ALTER COLUMN "grantedById" DROP NOT NULL;

CREATE TABLE "SystemSetting" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "progressStartDay" INTEGER NOT NULL DEFAULT 25,
  "progressStartMinute" INTEGER NOT NULL DEFAULT 0,
  "progressEndDay" INTEGER NOT NULL DEFAULT 27,
  "progressEndMinute" INTEGER NOT NULL DEFAULT 1439,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  "sessionHours" INTEGER NOT NULL DEFAULT 24,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updatedById" TEXT,
  "updatedBySnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

CREATE TEMP TABLE "_RemediationClock" ("migrationTs" TIMESTAMP(3) NOT NULL) ON COMMIT DROP;
INSERT INTO "_RemediationClock" VALUES (transaction_timestamp());

-- Every pre-existing assignment is legacy until this migration deterministically
-- promotes one canonical compatibility projection.
UPDATE "UserTag" SET "source" = 'LEGACY';

-- ADMIN is governance-only. Any legacy study projection is revoked at the single
-- captured database timestamp before identity evidence is evaluated.
UPDATE "UserTag" AS ut
SET "revokedAt" = c."migrationTs", "source" = 'LEGACY'
FROM "User" AS u, "Tag" AS t, "_RemediationClock" AS c
WHERE ut."userId" = u."id"
  AND ut."tagId" = t."id"
  AND u."role" = 'ADMIN'
  AND ut."revokedAt" IS NULL
  AND (ut."expiresAt" IS NULL OR ut."expiresAt" > c."migrationTs")
  AND ut."projectId" IS NULL
  AND t."scope" = 'GLOBAL'
  AND t."isSystem" = true
  AND t."name" IN ('grad-master', 'grad-phd', 'advisor');

CREATE TEMP TABLE "_RemediationIdentityEvidence" ON COMMIT DROP AS
SELECT
  u."id" AS "userId",
  COUNT(e."userTagId")::INTEGER AS "tagCount",
  COALESCE(bool_or(e."tagName" = 'grad-master'), false) AS "hasMaster",
  COALESCE(bool_or(e."tagName" = 'grad-phd'), false) AS "hasDoctor",
  COALESCE(bool_or(e."tagName" = 'advisor'), false) AS "hasMentor"
FROM "User" AS u
LEFT JOIN (
  SELECT ut."id" AS "userTagId", ut."userId", t."name" AS "tagName"
  FROM "UserTag" AS ut
  JOIN "Tag" AS t ON t."id" = ut."tagId"
  CROSS JOIN "_RemediationClock" AS c
  WHERE ut."revokedAt" IS NULL
    AND (ut."expiresAt" IS NULL OR ut."expiresAt" > c."migrationTs")
    AND ut."projectId" IS NULL
    AND t."scope" = 'GLOBAL'
    AND t."isSystem" = true
    AND t."name" IN ('grad-master', 'grad-phd', 'advisor')
) AS e ON e."userId" = u."id"
WHERE u."role" = 'MEMBER'
GROUP BY u."id";

UPDATE "User"
SET
  "studyDegree" = NULL,
  "studyGrade" = NULL,
  "identityNeedsReview" = false,
  "identityMigrationNote" = NULL,
  "graduatedAt" = NULL,
  "scheduledDeletionAt" = NULL
WHERE "role" = 'ADMIN';

UPDATE "User" AS u
SET
  "studyDegree" = CASE
    WHEN e."tagCount" > 1 THEN NULL
    WHEN e."tagCount" = 1 AND e."hasMentor" THEN 'MENTOR'::"StudyDegree"
    WHEN e."tagCount" = 1 AND e."hasMaster" THEN 'MASTER'::"StudyDegree"
    WHEN e."tagCount" = 1 AND e."hasDoctor" THEN 'DOCTOR'::"StudyDegree"
    WHEN e."tagCount" = 0 AND btrim(COALESCE(u."legacyGrade", '')) IN ('研0', '研1', '研2', '研3') THEN 'MASTER'::"StudyDegree"
    WHEN e."tagCount" = 0 AND btrim(COALESCE(u."legacyGrade", '')) IN ('博1', '博2', '博3', '博4', '博5') THEN 'DOCTOR'::"StudyDegree"
    ELSE NULL
  END,
  "studyGrade" = CASE
    WHEN e."tagCount" = 1 AND e."hasMaster" THEN CASE btrim(COALESCE(u."legacyGrade", ''))
      WHEN '研0' THEN 'MASTER_0'::"StudyGrade"
      WHEN '研1' THEN 'MASTER_1'::"StudyGrade"
      WHEN '研2' THEN 'MASTER_2'::"StudyGrade"
      WHEN '研3' THEN 'MASTER_3'::"StudyGrade"
      ELSE NULL
    END
    WHEN e."tagCount" = 1 AND e."hasDoctor" THEN CASE btrim(COALESCE(u."legacyGrade", ''))
      WHEN '博1' THEN 'DOCTOR_1'::"StudyGrade"
      WHEN '博2' THEN 'DOCTOR_2'::"StudyGrade"
      WHEN '博3' THEN 'DOCTOR_3'::"StudyGrade"
      WHEN '博4' THEN 'DOCTOR_4'::"StudyGrade"
      WHEN '博5' THEN 'DOCTOR_5'::"StudyGrade"
      ELSE NULL
    END
    WHEN e."tagCount" = 0 THEN CASE btrim(COALESCE(u."legacyGrade", ''))
      WHEN '研0' THEN 'MASTER_0'::"StudyGrade"
      WHEN '研1' THEN 'MASTER_1'::"StudyGrade"
      WHEN '研2' THEN 'MASTER_2'::"StudyGrade"
      WHEN '研3' THEN 'MASTER_3'::"StudyGrade"
      WHEN '博1' THEN 'DOCTOR_1'::"StudyGrade"
      WHEN '博2' THEN 'DOCTOR_2'::"StudyGrade"
      WHEN '博3' THEN 'DOCTOR_3'::"StudyGrade"
      WHEN '博4' THEN 'DOCTOR_4'::"StudyGrade"
      WHEN '博5' THEN 'DOCTOR_5'::"StudyGrade"
      ELSE NULL
    END
    ELSE NULL
  END,
  "identityNeedsReview" = CASE
    WHEN e."tagCount" > 1 THEN true
    WHEN e."tagCount" = 1 AND e."hasMentor" THEN btrim(COALESCE(u."legacyGrade", '')) <> ''
    WHEN e."tagCount" = 1 AND e."hasMaster" THEN btrim(COALESCE(u."legacyGrade", '')) NOT IN ('研0', '研1', '研2', '研3')
    WHEN e."tagCount" = 1 AND e."hasDoctor" THEN btrim(COALESCE(u."legacyGrade", '')) NOT IN ('博1', '博2', '博3', '博4', '博5')
    WHEN e."tagCount" = 0 THEN btrim(COALESCE(u."legacyGrade", '')) NOT IN ('研0', '研1', '研2', '研3', '博1', '博2', '博3', '博4', '博5')
    ELSE true
  END,
  "identityMigrationNote" = CASE
    WHEN e."tagCount" > 1 THEN 'IDENTITY_TAG_CONFLICT'
    WHEN e."tagCount" = 1 AND e."hasMentor" AND btrim(COALESCE(u."legacyGrade", '')) <> '' THEN 'MENTOR_HAS_LEGACY_GRADE'
    WHEN e."tagCount" = 1 AND e."hasMaster" AND btrim(COALESCE(u."legacyGrade", '')) IN ('博1', '博2', '博3', '博4', '博5') THEN 'GRADE_DEGREE_CONFLICT'
    WHEN e."tagCount" = 1 AND e."hasDoctor" AND btrim(COALESCE(u."legacyGrade", '')) IN ('研0', '研1', '研2', '研3') THEN 'GRADE_DEGREE_CONFLICT'
    WHEN e."tagCount" = 1 AND e."hasMaster" AND btrim(COALESCE(u."legacyGrade", '')) NOT IN ('研0', '研1', '研2', '研3') THEN 'GRADE_UNMAPPED'
    WHEN e."tagCount" = 1 AND e."hasDoctor" AND btrim(COALESCE(u."legacyGrade", '')) NOT IN ('博1', '博2', '博3', '博4', '博5') THEN 'GRADE_UNMAPPED'
    WHEN e."tagCount" = 0 AND btrim(COALESCE(u."legacyGrade", '')) NOT IN ('研0', '研1', '研2', '研3', '博1', '博2', '博3', '博4', '博5') THEN 'IDENTITY_EVIDENCE_MISSING'
    ELSE NULL
  END
FROM "_RemediationIdentityEvidence" AS e
WHERE u."id" = e."userId";

-- A legacy graduated mentor is invalid rather than guessed into a student degree.
UPDATE "User"
SET "identityNeedsReview" = true,
    "identityMigrationNote" = 'MENTOR_GRADUATED_LEGACY',
    "graduatedAt" = NULL,
    "scheduledDeletionAt" = NULL
WHERE "status" = 'GRADUATED' AND "studyDegree" = 'MENTOR';

-- Revoke effective study Tags that disagree with the resolved canonical identity.
UPDATE "UserTag" AS ut
SET "revokedAt" = c."migrationTs", "source" = 'LEGACY'
FROM "User" AS u, "Tag" AS t, "_RemediationClock" AS c
WHERE ut."userId" = u."id"
  AND ut."tagId" = t."id"
  AND u."role" = 'MEMBER'
  AND u."identityNeedsReview" = false
  AND ut."revokedAt" IS NULL
  AND (ut."expiresAt" IS NULL OR ut."expiresAt" > c."migrationTs")
  AND ut."projectId" IS NULL
  AND t."scope" = 'GLOBAL'
  AND t."isSystem" = true
  AND t."name" IN ('grad-master', 'grad-phd', 'advisor')
  AND t."name" <> CASE u."studyDegree"
    WHEN 'MASTER' THEN 'grad-master'
    WHEN 'DOCTOR' THEN 'grad-phd'
    WHEN 'MENTOR' THEN 'advisor'
  END;

WITH ranked AS (
  SELECT
    ut."id",
    row_number() OVER (PARTITION BY ut."userId" ORDER BY ut."createdAt", ut."id") AS rn
  FROM "UserTag" AS ut
  JOIN "User" AS u ON u."id" = ut."userId"
  JOIN "Tag" AS t ON t."id" = ut."tagId"
  CROSS JOIN "_RemediationClock" AS c
  WHERE u."role" = 'MEMBER'
    AND u."identityNeedsReview" = false
    AND ut."revokedAt" IS NULL
    AND (ut."expiresAt" IS NULL OR ut."expiresAt" > c."migrationTs")
    AND ut."projectId" IS NULL
    AND t."scope" = 'GLOBAL'
    AND t."isSystem" = true
    AND t."name" = CASE u."studyDegree"
      WHEN 'MASTER' THEN 'grad-master'
      WHEN 'DOCTOR' THEN 'grad-phd'
      WHEN 'MENTOR' THEN 'advisor'
    END
)
UPDATE "UserTag" AS ut
SET
  "source" = CASE WHEN ranked.rn = 1 THEN 'STUDY_IDENTITY'::"UserTagSource" ELSE 'LEGACY'::"UserTagSource" END,
  "revokedAt" = CASE WHEN ranked.rn = 1 THEN ut."revokedAt" ELSE c."migrationTs" END
FROM ranked, "_RemediationClock" AS c
WHERE ut."id" = ranked."id";

INSERT INTO "UserTag" (
  "id", "userId", "tagId", "projectId", "grantedById", "expiresAt",
  "revokedAt", "revokedById", "source", "createdAt"
)
SELECT
  'migident_' || substr(md5(u."id"), 1, 15),
  u."id",
  t."id",
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'STUDY_IDENTITY',
  c."migrationTs"
FROM "User" AS u
JOIN "Tag" AS t ON t."name" = CASE u."studyDegree"
  WHEN 'MASTER' THEN 'grad-master'
  WHEN 'DOCTOR' THEN 'grad-phd'
  WHEN 'MENTOR' THEN 'advisor'
END
CROSS JOIN "_RemediationClock" AS c
WHERE u."role" = 'MEMBER'
  AND u."identityNeedsReview" = false
  AND t."scope" = 'GLOBAL'
  AND t."isSystem" = true
  AND NOT EXISTS (
    SELECT 1 FROM "UserTag" AS existing
    WHERE existing."userId" = u."id"
      AND existing."source" = 'STUDY_IDENTITY'
      AND existing."revokedAt" IS NULL
  )
ON CONFLICT ("id") DO NOTHING;

-- Separate, permissionless graduation marker. Capability remains determined by
-- ACTIVE status and canonical study identity.
INSERT INTO "Tag" (
  "id", "name", "displayName", "description", "permissions", "scope",
  "isSystem", "templateId", "createdAt", "updatedAt"
)
SELECT
  'system_graduated', 'graduated', '已毕业', '系统维护的毕业状态标记',
  '[]'::jsonb, 'GLOBAL', true, NULL, c."migrationTs", c."migrationTs"
FROM "_RemediationClock" AS c
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "UserTag" (
  "id", "userId", "tagId", "projectId", "grantedById", "expiresAt",
  "revokedAt", "revokedById", "source", "createdAt"
)
SELECT
  'miggrad_' || substr(md5(u."id"), 1, 16),
  u."id", t."id", NULL, NULL, NULL, NULL, NULL, 'MANUAL', c."migrationTs"
FROM "User" AS u
JOIN "Tag" AS t ON t."name" = 'graduated'
CROSS JOIN "_RemediationClock" AS c
WHERE u."status" = 'GRADUATED'
  AND NOT EXISTS (
    SELECT 1 FROM "UserTag" AS existing
    WHERE existing."userId" = u."id"
      AND existing."tagId" = t."id"
      AND existing."revokedAt" IS NULL
  )
ON CONFLICT ("id") DO NOTHING;

UPDATE "User" AS u
SET
  "graduatedAt" = c."migrationTs",
  "scheduledDeletionAt" = c."migrationTs" + INTERVAL '72 hours'
FROM "_RemediationClock" AS c
WHERE u."status" = 'GRADUATED'
  AND u."identityNeedsReview" = false
  AND u."studyDegree" IN ('MASTER', 'DOCTOR');

UPDATE "User"
SET "graduatedAt" = NULL, "scheduledDeletionAt" = NULL
WHERE "status" <> 'GRADUATED' OR "identityNeedsReview" = true;

-- Canonical project archive/status/leader backfill. The exact Tag predicate is
-- intentionally repeated here rather than delegated to application convention.
UPDATE "Project"
SET "archivedAt" = "updatedAt"
WHERE "status" = 'ARCHIVED' AND "archivedAt" IS NULL;

CREATE TEMP TABLE "_RemediationProjectLeadEvidence" ON COMMIT DROP AS
SELECT ut."id" AS "userTagId", ut."userId", ut."projectId"
FROM "UserTag" AS ut
JOIN "Tag" AS t ON t."id" = ut."tagId"
JOIN "TagTemplate" AS tt ON tt."id" = t."templateId"
JOIN "Project" AS p ON p."id" = ut."projectId"
CROSS JOIN "_RemediationClock" AS c
WHERE ut."revokedAt" IS NULL
  AND (ut."expiresAt" IS NULL OR ut."expiresAt" > c."migrationTs")
  AND ut."projectId" = p."id"
  AND t."scope" = 'PROJECT'
  AND t."isSystem" = true
  AND t."name" = ('project-lead:' || p."id")
  AND t."templateId" IS NOT NULL
  AND tt."name" = 'project-lead';

WITH grouped AS (
  SELECT "projectId", count(*)::INTEGER AS assignment_count, min("userId") AS "userId"
  FROM "_RemediationProjectLeadEvidence"
  GROUP BY "projectId"
)
UPDATE "Project" AS p
SET
  "leaderId" = CASE WHEN grouped.assignment_count = 1 THEN grouped."userId" ELSE NULL END,
  "leaderNeedsReassignment" = CASE
    WHEN p."deletedAt" IS NOT NULL OR p."archivedAt" IS NOT NULL OR p."status" = 'COMPLETED' THEN false
    ELSE grouped.assignment_count <> 1
  END
FROM grouped
WHERE p."id" = grouped."projectId";

UPDATE "Project" AS p
SET "leaderId" = NULL,
    "leaderNeedsReassignment" = (
      p."deletedAt" IS NULL AND p."archivedAt" IS NULL AND p."status" <> 'COMPLETED'
    )
WHERE NOT EXISTS (
  SELECT 1 FROM "_RemediationProjectLeadEvidence" AS e WHERE e."projectId" = p."id"
);

WITH grouped AS (
  SELECT "projectId", count(*)::INTEGER AS assignment_count, min("userTagId") AS "userTagId"
  FROM "_RemediationProjectLeadEvidence"
  GROUP BY "projectId"
)
UPDATE "UserTag" AS ut
SET "source" = 'PROJECT_LEAD'
FROM grouped
WHERE grouped.assignment_count = 1 AND ut."id" = grouped."userTagId";

UPDATE "Project" AS p
SET "status" = CASE
  WHEN p."archivedAt" IS NOT NULL THEN 'ARCHIVED'::"ProjectStatus"
  WHEN p."status" = 'COMPLETED' THEN 'COMPLETED'::"ProjectStatus"
  WHEN EXISTS (
    SELECT 1 FROM "ProjectNode" AS n
    WHERE n."projectId" = p."id" AND n."deletedAt" IS NULL
  ) THEN 'IN_PROGRESS'::"ProjectStatus"
  ELSE 'PLANNING'::"ProjectStatus"
END;

INSERT INTO "SystemSetting" (
  "id", "progressStartDay", "progressStartMinute", "progressEndDay",
  "progressEndMinute", "timezone", "sessionHours", "revision", "updatedAt"
)
SELECT 'singleton', 25, 0, 27, 1439, 'Asia/Shanghai', 24, 0, c."migrationTs"
FROM "_RemediationClock" AS c
ON CONFLICT ("id") DO NOTHING;

-- One bounded, privacy-minimized snapshot per live account. Consumers use the
-- live relation first and this value only after the relation becomes null.
CREATE TEMP TABLE "_RemediationActorSnapshot" ON COMMIT DROP AS
SELECT
  u."id" AS "userId",
  jsonb_build_object(
    'v', 1,
    'displayName', left(COALESCE(NULLIF(btrim(u."displayName"), ''), '已删除用户'), 160),
    'studyDegree', u."studyDegree",
    'accountState', u."status",
    'capturedAt', c."migrationTs"
  ) AS snapshot
FROM "User" AS u
CROSS JOIN "_RemediationClock" AS c;

UPDATE "User" AS row SET "advisorSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."advisorId" = s."userId";
UPDATE "Announcement" AS row SET "authorSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."authorId" = s."userId";
UPDATE "Post" AS row SET "authorSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."authorId" = s."userId";
UPDATE "Comment" AS row SET "authorSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."authorId" = s."userId";
UPDATE "Project" AS row SET "creatorSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."creatorId" = s."userId";
UPDATE "Project" AS row SET "advisorSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."advisorId" = s."userId";
UPDATE "Project" AS row SET "leaderSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."leaderId" = s."userId";
UPDATE "Project" AS row SET "archivedBySnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."archivedById" = s."userId";
UPDATE "ProjectMember" AS row SET "memberSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."userId" = s."userId";
UPDATE "ProjectNode" AS row SET "authorSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."authorId" = s."userId";
UPDATE "ProgressReport" AS row SET "userSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."userId" = s."userId";
UPDATE "Notification" AS row SET "senderSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."senderId" = s."userId";
UPDATE "AuditLog" AS row SET "actorSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."userId" = s."userId";
UPDATE "UserTag" AS row SET "granterSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."grantedById" = s."userId";
UPDATE "UserTag" AS row SET "revokerSnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."revokedById" = s."userId";
UPDATE "SystemSetting" AS row SET "updatedBySnapshot" = s.snapshot
FROM "_RemediationActorSnapshot" AS s WHERE row."updatedById" = s."userId";

-- A recent malformed/expired legacy lead can provide display history only.
WITH historical AS (
  SELECT
    ut."projectId",
    s.snapshot,
    row_number() OVER (
      PARTITION BY ut."projectId" ORDER BY ut."createdAt" DESC, ut."id" DESC
    ) AS rn
  FROM "UserTag" AS ut
  JOIN "Tag" AS t ON t."id" = ut."tagId"
  JOIN "TagTemplate" AS tt ON tt."id" = t."templateId" AND tt."name" = 'project-lead'
  JOIN "Project" AS p ON p."id" = ut."projectId"
  JOIN "_RemediationActorSnapshot" AS s ON s."userId" = ut."userId"
  WHERE t."scope" = 'PROJECT'
    AND t."isSystem" = true
    AND t."name" = ('project-lead:' || p."id")
)
UPDATE "Project" AS p
SET "leaderSnapshot" = historical.snapshot
FROM historical
WHERE p."id" = historical."projectId"
  AND historical.rn = 1
  AND p."leaderId" IS NULL
  AND p."leaderSnapshot" IS NULL;

-- Contract: enforce canonical rows while deliberately retaining ambiguous legacy
-- identity evidence for explicit administrative repair.
ALTER TABLE "User" ADD CONSTRAINT "User_identity_contract_check" CHECK (
  (
    "role" = 'ADMIN'
    AND "studyDegree" IS NULL
    AND "studyGrade" IS NULL
    AND "identityNeedsReview" = false
    AND "identityMigrationNote" IS NULL
  )
  OR
  (
    "role" = 'MEMBER'
    AND (
      (
        "identityNeedsReview" = true
        AND "studyGrade" IS NULL
        AND NULLIF(btrim("identityMigrationNote"), '') IS NOT NULL
      )
      OR
      (
        "identityNeedsReview" = false
        AND "identityMigrationNote" IS NULL
        AND (
          ("studyDegree" = 'MENTOR' AND "studyGrade" IS NULL)
          OR ("studyDegree" = 'MASTER' AND "studyGrade" IN ('MASTER_0', 'MASTER_1', 'MASTER_2', 'MASTER_3'))
          OR ("studyDegree" = 'DOCTOR' AND "studyGrade" IN ('DOCTOR_1', 'DOCTOR_2', 'DOCTOR_3', 'DOCTOR_4', 'DOCTOR_5'))
        )
      )
    )
  )
);

ALTER TABLE "User" ADD CONSTRAINT "User_graduation_contract_check" CHECK (
  (
    "status" <> 'GRADUATED'
    AND "graduatedAt" IS NULL
    AND "scheduledDeletionAt" IS NULL
  )
  OR
  (
    "status" = 'GRADUATED'
    AND "identityNeedsReview" = true
    AND "graduatedAt" IS NULL
    AND "scheduledDeletionAt" IS NULL
  )
  OR
  (
    "status" = 'GRADUATED'
    AND "identityNeedsReview" = false
    AND "studyDegree" IN ('MASTER', 'DOCTOR')
    AND "graduatedAt" IS NOT NULL
    AND "scheduledDeletionAt" = "graduatedAt" + INTERVAL '72 hours'
  )
);

ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_source_scope_check" CHECK (
  ("source" <> 'STUDY_IDENTITY' OR "projectId" IS NULL)
  AND ("source" <> 'PROJECT_LEAD' OR "projectId" IS NOT NULL)
);

ALTER TABLE "Project" ADD CONSTRAINT "Project_leader_reassignment_check" CHECK (
  NOT ("leaderId" IS NOT NULL AND "leaderNeedsReassignment" = true)
);

ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_singleton_check" CHECK ("id" = 'singleton');
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_values_check" CHECK (
  "progressStartDay" BETWEEN 1 AND 31
  AND "progressEndDay" BETWEEN 1 AND 31
  AND "progressStartMinute" BETWEEN 0 AND 1439
  AND "progressEndMinute" BETWEEN 0 AND 1439
  AND (("progressStartDay" * 1440) + "progressStartMinute")
      < (("progressEndDay" * 1440) + "progressEndMinute")
  AND "timezone" = 'Asia/Shanghai'
  AND "sessionHours" BETWEEN 1 AND 720
  AND "revision" >= 0
);

ALTER TABLE "User" ADD CONSTRAINT "User_advisorSnapshot_size_check"
  CHECK ("advisorSnapshot" IS NULL OR pg_column_size("advisorSnapshot") <= 2048);
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorSnapshot_size_check"
  CHECK ("authorSnapshot" IS NULL OR pg_column_size("authorSnapshot") <= 2048);
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorSnapshot_size_check"
  CHECK ("authorSnapshot" IS NULL OR pg_column_size("authorSnapshot") <= 2048);
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorSnapshot_size_check"
  CHECK ("authorSnapshot" IS NULL OR pg_column_size("authorSnapshot") <= 2048);
ALTER TABLE "Project" ADD CONSTRAINT "Project_snapshot_size_check" CHECK (
  ("creatorSnapshot" IS NULL OR pg_column_size("creatorSnapshot") <= 2048)
  AND ("advisorSnapshot" IS NULL OR pg_column_size("advisorSnapshot") <= 2048)
  AND ("leaderSnapshot" IS NULL OR pg_column_size("leaderSnapshot") <= 2048)
  AND ("archivedBySnapshot" IS NULL OR pg_column_size("archivedBySnapshot") <= 2048)
);
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_memberSnapshot_size_check"
  CHECK ("memberSnapshot" IS NULL OR pg_column_size("memberSnapshot") <= 2048);
ALTER TABLE "ProjectNode" ADD CONSTRAINT "ProjectNode_authorSnapshot_size_check"
  CHECK ("authorSnapshot" IS NULL OR pg_column_size("authorSnapshot") <= 2048);
ALTER TABLE "ProgressReport" ADD CONSTRAINT "ProgressReport_userSnapshot_size_check"
  CHECK ("userSnapshot" IS NULL OR pg_column_size("userSnapshot") <= 2048);
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_senderSnapshot_size_check"
  CHECK ("senderSnapshot" IS NULL OR pg_column_size("senderSnapshot") <= 2048);
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorSnapshot_size_check"
  CHECK ("actorSnapshot" IS NULL OR pg_column_size("actorSnapshot") <= 2048);
ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_snapshot_size_check" CHECK (
  ("granterSnapshot" IS NULL OR pg_column_size("granterSnapshot") <= 2048)
  AND ("revokerSnapshot" IS NULL OR pg_column_size("revokerSnapshot") <= 2048)
);
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedBySnapshot_size_check"
  CHECK ("updatedBySnapshot" IS NULL OR pg_column_size("updatedBySnapshot") <= 2048);

CREATE INDEX "SystemSetting_updatedById_idx" ON "SystemSetting"("updatedById");
CREATE INDEX "Project_leaderId_idx" ON "Project"("leaderId");
CREATE INDEX "Project_archivedById_idx" ON "Project"("archivedById");
CREATE INDEX "Project_archivedAt_idx" ON "Project"("archivedAt");
CREATE INDEX "User_studyDegree_idx" ON "User"("studyDegree");
CREATE INDEX "User_identityNeedsReview_idx" ON "User"("identityNeedsReview");
CREATE INDEX "User_scheduledDeletionAt_idx" ON "User"("scheduledDeletionAt");
CREATE INDEX "UserTag_source_idx" ON "UserTag"("source");

CREATE UNIQUE INDEX "UserTag_one_study_identity_per_user_key"
  ON "UserTag"("userId")
  WHERE "revokedAt" IS NULL AND "source" = 'STUDY_IDENTITY';
CREATE UNIQUE INDEX "UserTag_one_project_lead_per_project_key"
  ON "UserTag"("projectId")
  WHERE "revokedAt" IS NULL AND "source" = 'PROJECT_LEAD';

ALTER TABLE "User" ADD CONSTRAINT "User_advisorId_fkey"
  FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_grantedById_fkey"
  FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_revokedById_fkey"
  FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_advisorId_fkey"
  FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_leaderId_fkey"
  FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_archivedById_fkey"
  FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectNode" ADD CONSTRAINT "ProjectNode_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProgressReport" ADD CONSTRAINT "ProgressReport_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Stored project status is a database-guarded projection. REVIEW and an
-- archive-without-archivedAt value cannot be persisted by any write path.
CREATE OR REPLACE FUNCTION lab_sync_project_status(target_project_id TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "Project" AS p
  SET "status" = CASE
    WHEN p."archivedAt" IS NOT NULL THEN 'ARCHIVED'::"ProjectStatus"
    WHEN p."status" = 'COMPLETED' THEN 'COMPLETED'::"ProjectStatus"
    WHEN EXISTS (
      SELECT 1 FROM "ProjectNode" AS n
      WHERE n."projectId" = p."id" AND n."deletedAt" IS NULL
    ) THEN 'IN_PROGRESS'::"ProjectStatus"
    ELSE 'PLANNING'::"ProjectStatus"
  END
  WHERE p."id" = target_project_id;
END;
$$;

CREATE OR REPLACE FUNCTION lab_project_node_status_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM lab_sync_project_status(OLD."projectId");
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."projectId" IS DISTINCT FROM NEW."projectId" THEN
    PERFORM lab_sync_project_status(OLD."projectId");
  END IF;
  PERFORM lab_sync_project_status(NEW."projectId");
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ProjectNode_sync_project_status"
AFTER INSERT OR DELETE OR UPDATE OF "projectId", "deletedAt" ON "ProjectNode"
FOR EACH ROW EXECUTE FUNCTION lab_project_node_status_trigger();

CREATE OR REPLACE FUNCTION lab_project_status_guard_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."status" := CASE
    WHEN NEW."archivedAt" IS NOT NULL THEN 'ARCHIVED'::"ProjectStatus"
    WHEN NEW."status" = 'COMPLETED' THEN 'COMPLETED'::"ProjectStatus"
    WHEN EXISTS (
      SELECT 1 FROM "ProjectNode" AS n
      WHERE n."projectId" = NEW."id" AND n."deletedAt" IS NULL
    ) THEN 'IN_PROGRESS'::"ProjectStatus"
    ELSE 'PLANNING'::"ProjectStatus"
  END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Project_guard_status_projection"
BEFORE INSERT OR UPDATE OF "status", "archivedAt" ON "Project"
FOR EACH ROW EXECUTE FUNCTION lab_project_status_guard_trigger();

-- Migration-time verification: fail atomically rather than accepting partial
-- identity, attribution, settings, or project projection state.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User" AS u
    WHERE u."role" = 'MEMBER'
      AND u."identityNeedsReview" = false
      AND (
        SELECT count(*) FROM "UserTag" AS ut
        WHERE ut."userId" = u."id"
          AND ut."source" = 'STUDY_IDENTITY'
          AND ut."revokedAt" IS NULL
      ) <> 1
  ) THEN
    RAISE EXCEPTION 'Resolved member is missing exactly one protected study identity projection.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Project" AS p
    WHERE p."status" <> CASE
      WHEN p."archivedAt" IS NOT NULL THEN 'ARCHIVED'::"ProjectStatus"
      WHEN p."status" = 'COMPLETED' THEN 'COMPLETED'::"ProjectStatus"
      WHEN EXISTS (
        SELECT 1 FROM "ProjectNode" AS n
        WHERE n."projectId" = p."id" AND n."deletedAt" IS NULL
      ) THEN 'IN_PROGRESS'::"ProjectStatus"
      ELSE 'PLANNING'::"ProjectStatus"
    END
  ) THEN
    RAISE EXCEPTION 'Project status projection backfill is inconsistent.';
  END IF;

  IF (SELECT count(*) FROM "SystemSetting") <> 1 THEN
    RAISE EXCEPTION 'SystemSetting singleton was not created exactly once.';
  END IF;

  IF EXISTS (SELECT 1 FROM "Announcement" WHERE "authorId" IS NOT NULL AND "authorSnapshot" IS NULL)
    OR EXISTS (SELECT 1 FROM "Post" WHERE "authorId" IS NOT NULL AND "authorSnapshot" IS NULL)
    OR EXISTS (SELECT 1 FROM "Comment" WHERE "authorId" IS NOT NULL AND "authorSnapshot" IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectMember" WHERE "userId" IS NOT NULL AND "memberSnapshot" IS NULL)
    OR EXISTS (SELECT 1 FROM "ProjectNode" WHERE "authorId" IS NOT NULL AND "authorSnapshot" IS NULL)
    OR EXISTS (SELECT 1 FROM "ProgressReport" WHERE "userId" IS NOT NULL AND "userSnapshot" IS NULL)
  THEN
    RAISE EXCEPTION 'Required history attribution snapshot backfill is incomplete.';
  END IF;
END;
$$;

COMMIT;
