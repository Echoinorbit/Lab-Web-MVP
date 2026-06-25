-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "TagScope" AS ENUM ('GLOBAL', 'PROJECT');
CREATE TYPE "NotifyTarget" AS ENUM ('ALL', 'PROJECT', 'TAG', 'USERS');
CREATE TYPE "PostCategory" AS ENUM ('GENERAL', 'EXPERIENCE', 'TUTORIAL', 'DISCUSSION', 'RESOURCE');
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "NodeType" AS ENUM ('MILESTONE', 'UPDATE', 'DECISION', 'ISSUE', 'RESOURCE');
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "NotificationType" AS ENUM ('ANNOUNCEMENT_NEW', 'ANNOUNCEMENT_URGENT', 'POST_COMMENT', 'PROJECT_NODE_NEW', 'PROJECT_STATUS', 'TAG_GRANTED', 'TAG_REQUEST', 'SYSTEM');
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'ACCOUNT_LOCKED', 'PASSWORD_RESET', 'PASSWORD_CHANGE', 'TAG_GRANT', 'TAG_REVOKE', 'TAG_REQUEST', 'ROLE_CHANGE', 'STATUS_CHANGE', 'ADVISOR_CHANGE', 'EXPORT', 'IMPORT', 'PROGRESS_BACKFILL', 'PERMISSION_DENIED', 'SESSION_REVOKE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatar" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "bio" TEXT,
    "studentId" TEXT,
    "grade" TEXT,
    "advisorId" TEXT,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "loginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB,
    "scope" "TagScope" NOT NULL DEFAULT 'GLOBAL',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TagTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TagTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "projectId" TEXT,
    "grantedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "targetType" "NotifyTarget" NOT NULL DEFAULT 'ALL',
    "targetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "category" "PostCategory" NOT NULL DEFAULT 'GENERAL',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProjectNode" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "nodeType" "NodeType" NOT NULL DEFAULT 'UPDATE',
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "ProjectNode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgressReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "studySummary" TEXT,
    "projectSummary" TEXT,
    "thesisSummary" TEXT,
    "otherWork" TEXT,
    "externalDays" INTEGER NOT NULL DEFAULT 0,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgressReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "relatedId" TEXT,
    "relatedType" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimitCounter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IpLoginFailureCounter" (
    "id" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IpLoginFailureCounter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProgressBackfillWindow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "openedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgressBackfillWindow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_advisorId_idx" ON "User"("advisorId");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE INDEX "Tag_scope_idx" ON "Tag"("scope");
CREATE INDEX "Tag_templateId_idx" ON "Tag"("templateId");
CREATE UNIQUE INDEX "TagTemplate_name_key" ON "TagTemplate"("name");
CREATE INDEX "UserTag_userId_idx" ON "UserTag"("userId");
CREATE INDEX "UserTag_tagId_idx" ON "UserTag"("tagId");
CREATE INDEX "UserTag_projectId_idx" ON "UserTag"("projectId");
CREATE INDEX "UserTag_revokedAt_idx" ON "UserTag"("revokedAt");
CREATE INDEX "Announcement_authorId_idx" ON "Announcement"("authorId");
CREATE INDEX "Announcement_deletedAt_idx" ON "Announcement"("deletedAt");
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");
CREATE INDEX "Post_authorId_idx" ON "Post"("authorId");
CREATE INDEX "Post_category_idx" ON "Post"("category");
CREATE INDEX "Post_deletedAt_idx" ON "Post"("deletedAt");
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");
CREATE INDEX "Comment_postId_idx" ON "Comment"("postId");
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");
CREATE INDEX "Comment_deletedAt_idx" ON "Comment"("deletedAt");
CREATE INDEX "Project_creatorId_idx" ON "Project"("creatorId");
CREATE INDEX "Project_status_idx" ON "Project"("status");
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");
CREATE UNIQUE INDEX "ProjectMember_userId_projectId_key" ON "ProjectMember"("userId", "projectId");
CREATE INDEX "ProjectNode_projectId_idx" ON "ProjectNode"("projectId");
CREATE INDEX "ProjectNode_parentId_idx" ON "ProjectNode"("parentId");
CREATE INDEX "ProjectNode_authorId_idx" ON "ProjectNode"("authorId");
CREATE INDEX "ProjectNode_nodeType_idx" ON "ProjectNode"("nodeType");
CREATE INDEX "ProjectNode_deletedAt_idx" ON "ProjectNode"("deletedAt");
CREATE INDEX "ProgressReport_userId_idx" ON "ProgressReport"("userId");
CREATE INDEX "ProgressReport_year_month_idx" ON "ProgressReport"("year", "month");
CREATE INDEX "ProgressReport_deletedAt_idx" ON "ProgressReport"("deletedAt");
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX "Notification_relatedType_relatedId_idx" ON "Notification"("relatedType", "relatedId");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "RateLimitCounter_action_windowStart_idx" ON "RateLimitCounter"("action", "windowStart");
CREATE UNIQUE INDEX "RateLimitCounter_userId_action_windowStart_key" ON "RateLimitCounter"("userId", "action", "windowStart");
CREATE INDEX "IpLoginFailureCounter_windowStart_idx" ON "IpLoginFailureCounter"("windowStart");
CREATE UNIQUE INDEX "IpLoginFailureCounter_ipAddress_windowStart_key" ON "IpLoginFailureCounter"("ipAddress", "windowStart");
CREATE INDEX "ProgressBackfillWindow_openedById_idx" ON "ProgressBackfillWindow"("openedById");
CREATE INDEX "ProgressBackfillWindow_expiresAt_idx" ON "ProgressBackfillWindow"("expiresAt");
CREATE UNIQUE INDEX "ProgressBackfillWindow_userId_year_month_key" ON "ProgressBackfillWindow"("userId", "year", "month");

-- Prisma cannot express these PostgreSQL partial unique indexes directly.
CREATE UNIQUE INDEX "UserTag_active_unique"
  ON "UserTag" ("userId", "tagId", COALESCE("projectId", ''))
  WHERE "revokedAt" IS NULL;

CREATE UNIQUE INDEX "ProgressReport_active_unique"
  ON "ProgressReport" ("userId", "year", "month")
  WHERE "deletedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TagTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTag" ADD CONSTRAINT "UserTag_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectNode" ADD CONSTRAINT "ProjectNode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectNode" ADD CONSTRAINT "ProjectNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProjectNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProjectNode" ADD CONSTRAINT "ProjectNode_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProgressReport" ADD CONSTRAINT "ProgressReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
