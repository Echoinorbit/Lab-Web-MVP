import { PrismaClient, Prisma } from "@prisma/client";
import { loadEnvConfig } from "@next/env";

type ProjectDrift = {
  id: string;
  name: string;
  storedStatus: string;
  expectedStatus: string;
  activeNodeCount: number;
};

type LifecycleDrift = {
  id: string;
  username: string;
  status: string;
  studyDegree: string | null;
  identityNeedsReview: boolean;
};

type IdentityProjectionDrift = {
  id: string;
  username: string;
  role: string;
  expectedTag: string | null;
  effectiveTags: string[];
  protectedProjectionCount: number;
};

const LEGACY_GRADE_MAPPING = {
  "研0": "MASTER_0",
  "研1": "MASTER_1",
  "研2": "MASTER_2",
  "研3": "MASTER_3",
  "博1": "DOCTOR_1",
  "博2": "DOCTOR_2",
  "博3": "DOCTOR_3",
  "博4": "DOCTOR_4",
  "博5": "DOCTOR_5",
} as const;

export async function buildReport(prisma: PrismaClient) {
  return prisma.$transaction(async (tx) => {
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>(Prisma.sql`SELECT transaction_timestamp() AS now`);
    const [
      unresolvedIdentities,
      identityReasons,
      tagConflicts,
      identityProjectionDrift,
      projectsWithoutLeader,
      projectDrift,
      lifecycleDrift,
      settings,
    ] = await Promise.all([
      tx.user.findMany({
        where: { identityNeedsReview: true },
        select: {
          id: true,
          username: true,
          displayName: true,
          legacyGrade: true,
          studyDegree: true,
          identityMigrationNote: true,
        },
        orderBy: [{ identityMigrationNote: "asc" }, { username: "asc" }],
      }),
      tx.user.groupBy({
        by: ["identityMigrationNote"],
        where: { identityNeedsReview: true },
        _count: { _all: true },
        orderBy: { identityMigrationNote: "asc" },
      }),
      tx.$queryRaw<Array<{ userId: string; username: string; assignmentCount: number }>>(Prisma.sql`
        SELECT u."id" AS "userId", u."username", count(*)::int AS "assignmentCount"
        FROM "User" u
        JOIN "UserTag" ut ON ut."userId" = u."id"
        JOIN "Tag" t ON t."id" = ut."tagId"
        WHERE ut."revokedAt" IS NULL
          AND (ut."expiresAt" IS NULL OR ut."expiresAt" > ${now})
          AND ut."projectId" IS NULL
          AND t."scope" = 'GLOBAL'
          AND t."isSystem" = true
          AND t."name" IN ('grad-master', 'grad-phd', 'advisor')
        GROUP BY u."id", u."username"
        HAVING count(*) > 1
        ORDER BY u."username"
      `),
      tx.$queryRaw<IdentityProjectionDrift[]>(Prisma.sql`
        WITH effective AS (
          SELECT
            ut."userId",
            t."name",
            ut."source"
          FROM "UserTag" ut
          JOIN "Tag" t ON t."id" = ut."tagId"
          WHERE ut."revokedAt" IS NULL
            AND (ut."expiresAt" IS NULL OR ut."expiresAt" > ${now})
            AND ut."projectId" IS NULL
            AND t."scope" = 'GLOBAL'
            AND t."isSystem" = true
            AND t."name" IN ('grad-master', 'grad-phd', 'advisor')
        ), summarized AS (
          SELECT
            u."id",
            u."username",
            u."role"::text AS role,
            CASE u."studyDegree"
              WHEN 'MASTER' THEN 'grad-master'
              WHEN 'DOCTOR' THEN 'grad-phd'
              WHEN 'MENTOR' THEN 'advisor'
              ELSE NULL
            END AS "expectedTag",
            COALESCE(array_agg(e."name" ORDER BY e."name") FILTER (WHERE e."name" IS NOT NULL), ARRAY[]::text[]) AS "effectiveTags",
            count(*) FILTER (WHERE e."source" = 'STUDY_IDENTITY')::int AS "protectedProjectionCount",
            count(e."name")::int AS "effectiveTagCount"
          FROM "User" u
          LEFT JOIN effective e ON e."userId" = u."id"
          GROUP BY u."id"
        )
        SELECT "id", "username", role, "expectedTag", "effectiveTags", "protectedProjectionCount"
        FROM summarized
        WHERE
          (role = 'ADMIN' AND "effectiveTagCount" <> 0)
          OR (
            role = 'MEMBER'
            AND (SELECT "identityNeedsReview" FROM "User" WHERE "User"."id" = summarized."id") = false
            AND (
              "effectiveTagCount" <> 1
              OR "protectedProjectionCount" <> 1
              OR "effectiveTags" <> ARRAY["expectedTag"]::text[]
            )
          )
        ORDER BY "username"
      `),
      tx.project.findMany({
        where: {
          deletedAt: null,
          archivedAt: null,
          status: { not: "COMPLETED" },
          OR: [{ leaderId: null }, { leaderNeedsReassignment: true }],
        },
        select: { id: true, name: true, leaderNeedsReassignment: true },
        orderBy: { name: "asc" },
      }),
      tx.$queryRaw<ProjectDrift[]>(Prisma.sql`
        SELECT
          p."id",
          p."name",
          p."status"::text AS "storedStatus",
          CASE
            WHEN p."archivedAt" IS NOT NULL THEN 'ARCHIVED'
            WHEN p."status" = 'COMPLETED' THEN 'COMPLETED'
            WHEN count(n."id") FILTER (WHERE n."deletedAt" IS NULL) > 0 THEN 'IN_PROGRESS'
            ELSE 'PLANNING'
          END AS "expectedStatus",
          count(n."id") FILTER (WHERE n."deletedAt" IS NULL)::int AS "activeNodeCount"
        FROM "Project" p
        LEFT JOIN "ProjectNode" n ON n."projectId" = p."id"
        GROUP BY p."id"
        HAVING p."status"::text <> CASE
          WHEN p."archivedAt" IS NOT NULL THEN 'ARCHIVED'
          WHEN p."status" = 'COMPLETED' THEN 'COMPLETED'
          WHEN count(n."id") FILTER (WHERE n."deletedAt" IS NULL) > 0 THEN 'IN_PROGRESS'
          ELSE 'PLANNING'
        END
        ORDER BY p."name"
      `),
      tx.$queryRaw<LifecycleDrift[]>(Prisma.sql`
        SELECT "id", "username", "status"::text, "studyDegree"::text, "identityNeedsReview"
        FROM "User"
        WHERE
          ("status" <> 'GRADUATED' AND ("graduatedAt" IS NOT NULL OR "scheduledDeletionAt" IS NOT NULL))
          OR (
            "status" = 'GRADUATED'
            AND "identityNeedsReview" = false
            AND (
              "studyDegree" NOT IN ('MASTER', 'DOCTOR')
              OR "graduatedAt" IS NULL
              OR "scheduledDeletionAt" <> "graduatedAt" + INTERVAL '72 hours'
            )
          )
        ORDER BY "username"
      `),
      tx.systemSetting.findMany({ orderBy: { id: "asc" } }),
    ]);

    const missingSnapshots = {
      announcements: await tx.announcement.count({ where: { authorId: { not: null }, authorSnapshot: { equals: Prisma.DbNull } } }),
      posts: await tx.post.count({ where: { authorId: { not: null }, authorSnapshot: { equals: Prisma.DbNull } } }),
      comments: await tx.comment.count({ where: { authorId: { not: null }, authorSnapshot: { equals: Prisma.DbNull } } }),
      projectMembers: await tx.projectMember.count({ where: { userId: { not: null }, memberSnapshot: { equals: Prisma.DbNull } } }),
      projectNodes: await tx.projectNode.count({ where: { authorId: { not: null }, authorSnapshot: { equals: Prisma.DbNull } } }),
      progressReports: await tx.progressReport.count({ where: { userId: { not: null }, userSnapshot: { equals: Prisma.DbNull } } }),
      userAdvisors: await tx.user.count({ where: { advisorId: { not: null }, advisorSnapshot: { equals: Prisma.DbNull } } }),
      projectCreators: await tx.project.count({ where: { creatorId: { not: null }, creatorSnapshot: { equals: Prisma.DbNull } } }),
      projectAdvisors: await tx.project.count({ where: { advisorId: { not: null }, advisorSnapshot: { equals: Prisma.DbNull } } }),
      projectLeaders: await tx.project.count({ where: { leaderId: { not: null }, leaderSnapshot: { equals: Prisma.DbNull } } }),
      projectArchivers: await tx.project.count({ where: { archivedById: { not: null }, archivedBySnapshot: { equals: Prisma.DbNull } } }),
      notificationSenders: await tx.notification.count({ where: { senderId: { not: null }, senderSnapshot: { equals: Prisma.DbNull } } }),
      auditActors: await tx.auditLog.count({ where: { userId: { not: null }, actorSnapshot: { equals: Prisma.DbNull } } }),
      tagGranters: await tx.userTag.count({ where: { grantedById: { not: null }, granterSnapshot: { equals: Prisma.DbNull } } }),
      tagRevokers: await tx.userTag.count({ where: { revokedById: { not: null }, revokerSnapshot: { equals: Prisma.DbNull } } }),
      settingEditors: await tx.systemSetting.count({ where: { updatedById: { not: null }, updatedBySnapshot: { equals: Prisma.DbNull } } }),
    };

    return {
      generatedAt: now.toISOString(),
      ready:
        tagConflicts.length === 0
        && identityProjectionDrift.length === 0
        && projectsWithoutLeader.length === 0
        && projectDrift.length === 0
        && lifecycleDrift.length === 0
        && settings.length === 1
        && settings[0]?.id === "singleton"
        && Object.values(missingSnapshots).every((count) => count === 0),
      exactLegacyGradeMapping: LEGACY_GRADE_MAPPING,
      unresolvedIdentities,
      identityReasonLedger: identityReasons.map((row) => ({
        reason: row.identityMigrationNote,
        count: row._count._all,
      })),
      conflictingEffectiveIdentityTags: tagConflicts,
      identityProjectionDrift,
      projectsWithoutLeader,
      projectStatusDrift: projectDrift,
      lifecycleDrift,
      settings,
      missingSnapshots,
    };
  }, { isolationLevel: "RepeatableRead" });
}

async function main() {
  loadEnvConfig(process.cwd());
  const prisma = new PrismaClient();
  try {
    console.log(JSON.stringify(await buildReport(prisma), null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
