-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'GRADUATED';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE "ProgressReport" ADD COLUMN     "editCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "advisorId" TEXT;

-- AlterTable
ALTER TABLE "ProjectNode" ADD COLUMN     "colorHex" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "enrollmentDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserPostTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPostTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditExportArchive" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "excelData" BYTEA NOT NULL,
    "seqInYear" INTEGER NOT NULL,
    "rangeStart" TIMESTAMP(3) NOT NULL,
    "rangeEnd" TIMESTAMP(3) NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "exportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditExportArchive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditExportCounter" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "exportsInYear" INTEGER NOT NULL DEFAULT 0,
    "cycleCount" INTEGER NOT NULL DEFAULT 0,
    "lastExportAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditExportCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPostTag_userId_idx" ON "UserPostTag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPostTag_userId_label_key" ON "UserPostTag"("userId", "label");

-- CreateIndex
CREATE INDEX "AuditExportArchive_exportedAt_idx" ON "AuditExportArchive"("exportedAt");

-- CreateIndex
CREATE INDEX "AuditExportArchive_expiresAt_idx" ON "AuditExportArchive"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuditExportCounter_year_key" ON "AuditExportCounter"("year");

-- CreateIndex
CREATE INDEX "Post_status_idx" ON "Post"("status");

-- CreateIndex
CREATE INDEX "Project_advisorId_idx" ON "Project"("advisorId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPostTag" ADD CONSTRAINT "UserPostTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
