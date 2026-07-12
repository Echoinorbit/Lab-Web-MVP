BEGIN;

CREATE TEMP TABLE "_ProjectResponsibilityClock" (
  "migrationTs" TIMESTAMP(3) NOT NULL
) ON COMMIT DROP;
INSERT INTO "_ProjectResponsibilityClock" VALUES (transaction_timestamp());

CREATE TEMP TABLE "_ProjectLeadEvidence" ON COMMIT DROP AS
SELECT
  ut."id" AS "userTagId",
  ut."userId",
  ut."projectId",
  ut."createdAt",
  (
    leader."role" = 'MEMBER'
    AND leader."status" = 'ACTIVE'
    AND leader."identityNeedsReview" = false
    AND leader."studyDegree" IN ('MASTER', 'DOCTOR')
    AND p."advisorId" IS NOT NULL
    AND advisor."role" = 'MEMBER'
    AND advisor."status" = 'ACTIVE'
    AND advisor."identityNeedsReview" = false
    AND advisor."studyDegree" = 'MENTOR'
    AND leader."advisorId" = p."advisorId"
  ) AS eligible
FROM "UserTag" AS ut
JOIN "Tag" AS t ON t."id" = ut."tagId"
JOIN "TagTemplate" AS tt ON tt."id" = t."templateId"
JOIN "Project" AS p ON p."id" = ut."projectId"
JOIN "User" AS leader ON leader."id" = ut."userId"
LEFT JOIN "User" AS advisor ON advisor."id" = p."advisorId"
CROSS JOIN "_ProjectResponsibilityClock" AS c
WHERE ut."revokedAt" IS NULL
  AND (ut."expiresAt" IS NULL OR ut."expiresAt" > c."migrationTs")
  AND t."scope" = 'PROJECT'
  AND t."isSystem" = true
  AND t."name" = ('project-lead:' || p."id")
  AND tt."name" = 'project-lead';

CREATE TEMP TABLE "_CanonicalProjectLead" ON COMMIT DROP AS
WITH grouped AS (
  SELECT "projectId"
  FROM "_ProjectLeadEvidence"
  GROUP BY "projectId"
  HAVING count(*) = 1
)
SELECT evidence."userTagId", evidence."userId", evidence."projectId"
FROM "_ProjectLeadEvidence" AS evidence
JOIN grouped ON grouped."projectId" = evidence."projectId"
WHERE evidence.eligible;

-- A sole legacy assignment remains useful attribution even when it is no
-- longer eligible to carry live project authority.
WITH sole AS (
  SELECT min("userId") AS "userId", "projectId"
  FROM "_ProjectLeadEvidence"
  GROUP BY "projectId"
  HAVING count(*) = 1
)
UPDATE "Project" AS p
SET "leaderSnapshot" = jsonb_build_object(
  'v', 1,
  'displayName', left(COALESCE(NULLIF(btrim(leader."displayName"), ''), '已删除用户'), 160),
  'studyDegree', leader."studyDegree",
  'accountState', leader."status",
  'capturedAt', c."migrationTs"
)
FROM sole
JOIN "User" AS leader ON leader."id" = sole."userId"
CROSS JOIN "_ProjectResponsibilityClock" AS c
WHERE p."id" = sole."projectId";

UPDATE "Project" AS p
SET
  "leaderId" = NULL,
  "leaderNeedsReassignment" = (
    p."deletedAt" IS NULL
    AND p."archivedAt" IS NULL
    AND p."status" NOT IN ('ARCHIVED', 'COMPLETED')
  );

UPDATE "Project" AS p
SET "leaderId" = canonical."userId", "leaderNeedsReassignment" = false
FROM "_CanonicalProjectLead" AS canonical
WHERE p."id" = canonical."projectId";

-- Keep legacy rows as evidence, but remove every non-canonical live capability.
UPDATE "UserTag" AS ut
SET "revokedAt" = c."migrationTs"
FROM "_ProjectResponsibilityClock" AS c
WHERE ut."projectId" IS NOT NULL
  AND ut."revokedAt" IS NULL
  AND (
    ut."source" = 'PROJECT_LEAD'
    OR EXISTS (
      SELECT 1 FROM "_ProjectLeadEvidence" AS evidence
      WHERE evidence."userTagId" = ut."id"
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM "_CanonicalProjectLead" AS canonical
    WHERE canonical."userTagId" = ut."id"
  );

UPDATE "UserTag" AS ut
SET "source" = 'PROJECT_LEAD'
FROM "_CanonicalProjectLead" AS canonical
WHERE ut."id" = canonical."userTagId";

INSERT INTO "ProjectMember" (
  "id", "userId", "projectId", "memberSnapshot", "joinedAt"
)
SELECT
  'responsibility_' || substr(md5(canonical."projectId" || ':' || canonical."userId"), 1, 20),
  canonical."userId",
  canonical."projectId",
  jsonb_build_object(
    'v', 1,
    'displayName', left(COALESCE(NULLIF(btrim(leader."displayName"), ''), '已删除用户'), 160),
    'studyDegree', leader."studyDegree",
    'accountState', leader."status",
    'capturedAt', c."migrationTs"
  ),
  c."migrationTs"
FROM "_CanonicalProjectLead" AS canonical
JOIN "User" AS leader ON leader."id" = canonical."userId"
CROSS JOIN "_ProjectResponsibilityClock" AS c
ON CONFLICT ("userId", "projectId") DO UPDATE
SET "memberSnapshot" = EXCLUDED."memberSnapshot";

UPDATE "Project" AS p
SET "leaderSnapshot" = jsonb_build_object(
  'v', 1,
  'displayName', left(COALESCE(NULLIF(btrim(leader."displayName"), ''), '已删除用户'), 160),
  'studyDegree', leader."studyDegree",
  'accountState', leader."status",
  'capturedAt', c."migrationTs"
)
FROM "User" AS leader
CROSS JOIN "_ProjectResponsibilityClock" AS c
WHERE p."leaderId" = leader."id";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Project" AS p
    JOIN "User" AS leader ON leader."id" = p."leaderId"
    LEFT JOIN "User" AS advisor ON advisor."id" = p."advisorId"
    WHERE p."leaderId" IS NOT NULL
      AND (
        p."advisorId" IS NULL
        OR advisor."id" IS NULL
        OR advisor."role" <> 'MEMBER'
        OR advisor."status" <> 'ACTIVE'
        OR advisor."identityNeedsReview" = true
        OR advisor."studyDegree" IS DISTINCT FROM 'MENTOR'::"StudyDegree"
        OR leader."role" <> 'MEMBER'
        OR leader."status" <> 'ACTIVE'
        OR leader."identityNeedsReview" = true
        OR leader."studyDegree" IS NULL
        OR leader."studyDegree" NOT IN ('MASTER', 'DOCTOR')
        OR leader."advisorId" IS DISTINCT FROM p."advisorId"
        OR (SELECT count(*) FROM "ProjectMember" AS pm
            WHERE pm."projectId" = p."id" AND pm."userId" = p."leaderId") <> 1
        OR (SELECT count(*)
            FROM "UserTag" AS ut
            JOIN "Tag" AS t ON t."id" = ut."tagId"
            JOIN "TagTemplate" AS tt ON tt."id" = t."templateId"
            CROSS JOIN "_ProjectResponsibilityClock" AS c
            WHERE ut."projectId" = p."id"
              AND ut."userId" = p."leaderId"
              AND ut."source" = 'PROJECT_LEAD'
              AND ut."revokedAt" IS NULL
              AND (ut."expiresAt" IS NULL OR ut."expiresAt" > c."migrationTs")
              AND t."scope" = 'PROJECT'
              AND t."isSystem" = true
              AND t."name" = ('project-lead:' || p."id")
              AND tt."name" = 'project-lead') <> 1
      )
  ) THEN
    RAISE EXCEPTION 'Canonical project leader reconciliation is inconsistent.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "UserTag" AS ut
    JOIN "Project" AS p ON p."id" = ut."projectId"
    CROSS JOIN "_ProjectResponsibilityClock" AS c
    WHERE ut."source" = 'PROJECT_LEAD'
      AND ut."revokedAt" IS NULL
      AND (ut."expiresAt" IS NULL OR ut."expiresAt" > c."migrationTs")
      AND ut."userId" IS DISTINCT FROM p."leaderId"
  ) OR EXISTS (
    SELECT 1
    FROM "UserTag" AS ut
    JOIN "Tag" AS t ON t."id" = ut."tagId"
    JOIN "TagTemplate" AS tt ON tt."id" = t."templateId"
    JOIN "Project" AS p ON p."id" = ut."projectId"
    CROSS JOIN "_ProjectResponsibilityClock" AS c
    WHERE ut."revokedAt" IS NULL
      AND (ut."expiresAt" IS NULL OR ut."expiresAt" > c."migrationTs")
      AND t."scope" = 'PROJECT'
      AND t."isSystem" = true
      AND t."name" = ('project-lead:' || p."id")
      AND tt."name" = 'project-lead'
      AND (ut."source" <> 'PROJECT_LEAD' OR ut."userId" IS DISTINCT FROM p."leaderId")
  ) THEN
    RAISE EXCEPTION 'Non-canonical project leader capability remains effective.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Project" AS p
    WHERE p."leaderNeedsReassignment" IS DISTINCT FROM (
      p."leaderId" IS NULL
      AND p."deletedAt" IS NULL
      AND p."archivedAt" IS NULL
      AND p."status" NOT IN ('ARCHIVED', 'COMPLETED')
    )
  ) THEN
    RAISE EXCEPTION 'Project leader reassignment flags are inconsistent.';
  END IF;
END;
$$;

COMMIT;
