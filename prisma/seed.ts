import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

import { CONTENT_AUTHOR_PERMISSIONS, PERMISSIONS } from "../src/shared/lib/permissions";

const prisma = new PrismaClient();

const SYSTEM_TAGS = [
  {
    name: "grad-master",
    displayName: "硕士",
    description: "硕士研究生，可发帖、评论并填写月度进度报告。",
    permissions: [
      ...CONTENT_AUTHOR_PERMISSIONS,
      PERMISSIONS.PROGRESS_REPORT_WRITE,
      PERMISSIONS.PROGRESS_REPORT_SUBMIT,
    ],
  },
  {
    name: "grad-phd",
    displayName: "博士",
    description: "博士研究生，可发帖、评论并填写月度进度报告。",
    permissions: [
      ...CONTENT_AUTHOR_PERMISSIONS,
      PERMISSIONS.PROGRESS_REPORT_WRITE,
      PERMISSIONS.PROGRESS_REPORT_SUBMIT,
    ],
  },
  {
    name: "advisor",
    displayName: "导师",
    description: "导师身份，可发帖、评论、发布公告并创建项目。",
    permissions: [
      ...CONTENT_AUTHOR_PERMISSIONS,
      PERMISSIONS.ANNOUNCEMENT_CREATE,
      PERMISSIONS.ANNOUNCEMENT_UPDATE,
      PERMISSIONS.ANNOUNCEMENT_NOTIFY_TARGETED,
      PERMISSIONS.PROJECT_CREATE,
      PERMISSIONS.PROGRESS_REPORT_READ_ADVISEES,
      PERMISSIONS.TAG_APPROVE,
      PERMISSIONS.TAG_REVOKE,
    ],
  },
  {
    name: "progress-mgr",
    displayName: "进度管理",
    description: "查看、导出和补填学生月度进度报告。",
    permissions: [
      PERMISSIONS.PROGRESS_REPORT_READ_ALL,
      PERMISSIONS.PROGRESS_EXPORT,
      PERMISSIONS.PROGRESS_BACKFILL,
    ],
  },
  {
    name: "graduated",
    displayName: "已毕业",
    description: "毕业状态标记，不增加额外权限。",
    permissions: [],
  },
] as const;

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminDisplayName = process.env.ADMIN_DISPLAY_NAME ?? "系统管理员";

  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD is required for prisma seed.");
  }

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      displayName: adminDisplayName,
      role: "ADMIN",
      mustChangePassword: true,
    },
  });

  await prisma.tagTemplate.upsert({
    where: { name: "project-lead" },
    update: {
      permissions: [
        PERMISSIONS.PROJECT_MANAGE,
        PERMISSIONS.PROJECT_MEMBER_MANAGE,
        PERMISSIONS.PROJECT_NODE_CREATE,
        PERMISSIONS.ANNOUNCEMENT_CREATE,
        PERMISSIONS.ANNOUNCEMENT_NOTIFY_TARGETED,
      ],
    },
    create: {
      name: "project-lead",
      displayName: "项目组长",
      permissions: [
        PERMISSIONS.PROJECT_MANAGE,
        PERMISSIONS.PROJECT_MEMBER_MANAGE,
        PERMISSIONS.PROJECT_NODE_CREATE,
        PERMISSIONS.ANNOUNCEMENT_CREATE,
        PERMISSIONS.ANNOUNCEMENT_NOTIFY_TARGETED,
      ],
    },
  });

  await prisma.tagTemplate.upsert({
    where: { name: "project-member" },
    update: {
      permissions: [PERMISSIONS.PROJECT_NODE_CREATE],
    },
    create: {
      name: "project-member",
      displayName: "项目成员",
      permissions: [PERMISSIONS.PROJECT_NODE_CREATE],
    },
  });

  for (const tag of SYSTEM_TAGS) {
    await prisma.tag.upsert({
      where: { name: tag.name },
      update: {
        displayName: tag.displayName,
        description: tag.description,
        permissions: [...tag.permissions],
        scope: "GLOBAL",
        isSystem: true,
      },
      create: {
        name: tag.name,
        displayName: tag.displayName,
        description: tag.description,
        permissions: [...tag.permissions],
        scope: "GLOBAL",
        isSystem: true,
      },
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
