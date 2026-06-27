/*
  Warnings:

  - A unique constraint covering the columns `[studentId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User"
    WHERE "studentId" IS NOT NULL
    GROUP BY "studentId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add User.studentId uniqueness: duplicate non-null studentId values exist.';
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");
