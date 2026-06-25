import { PrismaClient } from "@prisma/client";

import { graduateUserAccount, revokeEffectiveUserTags } from "../src/shared/lib/graduation";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const graduatedTagRows = await prisma.userTag.findMany({
    where: {
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      tag: { name: "graduated" },
    },
    select: { userId: true },
  });
  const userIds = [...new Set(graduatedTagRows.map((row) => row.userId))];

  for (const userId of userIds) {
    await prisma.$transaction(async (tx) => {
      const result = await graduateUserAccount(tx, userId, now);
      if (result.count === 0) {
        await revokeEffectiveUserTags(tx, userId, now);
      }
    });
  }

  console.log(`Migrated ${userIds.length} graduated-tag users.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
