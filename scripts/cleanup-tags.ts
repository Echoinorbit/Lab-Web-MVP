import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";

// Names of legitimate seed/system tags that must never be touched.
const SEED_TAG_NAMES = new Set([
  "grad-master",
  "grad-phd",
  "advisor",
  "progress-mgr",
  "graduated",
]);

// Templates that must always survive (created by prisma/seed.ts).
const SEED_TEMPLATE_NAMES = new Set(["project-lead", "project-member"]);

// Junk tags are auto-generated test artifacts left behind by removed/older test
// helpers. They look like `advisor-action-verify-advisor-action-mqq9yupt-target`
// or `advisor-verify-advisor-mqq94rq3-create-only`.
const GENERATED_VERIFY_TAG_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*-verify-[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{6,}-(?:target|create-only)$/i;
const JUNK_DISPLAY_NAMES = new Set(["Create Only"]);

export function isJunkTag(tag: { name: string; displayName: string; isSystem: boolean }): boolean {
  // Conservative guards first: never delete system tags or the legitimate
  // project-scoped tags emitted by create-project (`project-lead:<id>`).
  if (tag.isSystem) return false;
  if (SEED_TAG_NAMES.has(tag.name)) return false;
  if (tag.name.startsWith("project-lead:") || tag.name.startsWith("project-member:")) return false;

  if (JUNK_DISPLAY_NAMES.has(tag.displayName) && tag.name.includes("-verify-")) return true;
  if (GENERATED_VERIFY_TAG_PATTERN.test(tag.name)) return true;
  return false;
}

async function main() {
  loadEnvConfig(process.cwd());
  const prisma = new PrismaClient();

  try {
    const candidates = await prisma.tag.findMany({
      where: { isSystem: false },
      select: { id: true, name: true, displayName: true, isSystem: true },
    });

    const junk = candidates.filter(isJunkTag);

    if (junk.length === 0) {
      console.log("No junk tags found. Nothing to clean up.");
      return;
    }

    console.log(`Found ${junk.length} junk tag(s) to delete:`);
    for (const tag of junk) {
      console.log(`  - ${tag.name} ("${tag.displayName}")`);
    }

    const junkIds = junk.map((tag) => tag.id);

    // UserTag.tagId is onDelete: Cascade, so assignments are removed with the tag.
    // Count them up-front for an accurate report.
    const assignmentCount = await prisma.userTag.count({
      where: { tagId: { in: junkIds } },
    });

    await prisma.tag.deleteMany({ where: { id: { in: junkIds } } });

    // Clean up any orphaned, non-seed templates that no surviving tag references.
    const orphanTemplates = await prisma.tagTemplate.findMany({
      where: {
        name: { notIn: [...SEED_TEMPLATE_NAMES] },
        tags: { none: {} },
      },
      select: { id: true, name: true },
    });

    if (orphanTemplates.length > 0) {
      await prisma.tagTemplate.deleteMany({
        where: { id: { in: orphanTemplates.map((t) => t.id) } },
      });
    }

    console.log(
      `Deleted ${junk.length} junk tag(s), ${assignmentCount} tag assignment(s), ` +
        `and ${orphanTemplates.length} orphaned template(s).`,
    );
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
