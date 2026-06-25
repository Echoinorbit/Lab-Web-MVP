import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import bcrypt from "bcryptjs";

import { PERMISSIONS } from "../src/shared/lib/permissions";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const fixturePassword = process.env.E2E_FIXTURE_PASSWORD ?? "Test.pass.123";
const adminUsername = process.env.E2E_ADMIN_USERNAME ?? process.env.ADMIN_USERNAME ?? "admin";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? fixturePassword;
const adminDisplayName = process.env.ADMIN_DISPLAY_NAME ?? "系统管理员";
const year = 2026;
const month = 6;

const actorSpecs = [
  {
    username: "e2e-master",
    displayName: "研究生发帖测试员 张澄",
    studentId: "LAB2026-M001",
    grade: "2026级",
    tags: ["grad-master"],
  },
  {
    username: "e2e-phd",
    displayName: "博士发帖测试员 李研",
    studentId: "LAB2026-D001",
    grade: "2026级",
    tags: ["grad-phd"],
  },
  {
    username: "e2e-advisor",
    displayName: "导师发帖测试员 王明远",
    tags: ["advisor"],
  },
  {
    username: "e2e-progress-mgr",
    displayName: "进度管理博士 赵清越",
    studentId: "LAB2026-D002",
    grade: "2026级",
    tags: ["grad-phd", "progress-mgr"],
  },
  {
    username: "e2e-vision-lead",
    displayName: "图像识别项目组长 陈远航",
    studentId: "LAB2026-D003",
    grade: "2026级",
    tags: ["grad-phd"],
  },
  {
    username: "e2e-vision-member-a",
    displayName: "图像识别项目组员 林知夏",
    studentId: "LAB2026-M002",
    grade: "2026级",
    tags: ["grad-master"],
  },
  {
    username: "e2e-vision-member-b",
    displayName: "图像识别项目组员 周子衿",
    studentId: "LAB2026-M003",
    grade: "2026级",
    tags: ["grad-master"],
  },
] as const;

type ActorSpec = (typeof actorSpecs)[number];
type FixtureUser = Awaited<ReturnType<typeof ensureMember>>;

function utcDate(day: number, hour = 2) {
  return new Date(Date.UTC(2026, 5, day, hour, 0, 0));
}

async function ensureAdmin() {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  return prisma.user.upsert({
    where: { username: adminUsername },
    update: {
      displayName: adminDisplayName,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      mustChangePassword: false,
      loginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      username: adminUsername,
      displayName: adminDisplayName,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      mustChangePassword: false,
    },
  });
}

async function ensureMember(input: ActorSpec, passwordHash: string, adminId: string) {
  const user = await prisma.user.upsert({
    where: { username: input.username },
    update: {
      displayName: input.displayName,
      studentId: "studentId" in input ? input.studentId : null,
      grade: "grade" in input ? input.grade : null,
      passwordHash,
      role: "MEMBER",
      status: "ACTIVE",
      mustChangePassword: false,
      loginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      username: input.username,
      displayName: input.displayName,
      studentId: "studentId" in input ? input.studentId : null,
      grade: "grade" in input ? input.grade : null,
      passwordHash,
      role: "MEMBER",
      status: "ACTIVE",
      mustChangePassword: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      details: { fixture: true, username: input.username },
    },
  });

  return user;
}

async function ensureGlobalTagGrant(userId: string, tagName: string, adminId: string) {
  const tag = await prisma.tag.findUniqueOrThrow({ where: { name: tagName }, select: { id: true, displayName: true } });
  const existing = await prisma.userTag.findFirst({
    where: {
      userId,
      tagId: tag.id,
      projectId: null,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  if (existing) return existing;

  const grant = await prisma.userTag.create({
    data: { userId, tagId: tag.id, grantedById: adminId },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: "TAG_GRANT",
      entityType: "UserTag",
      entityId: grant.id,
      details: { fixture: true, tagName },
    },
  });
  await ensureNotification(userId, "TAG_GRANTED", `已获得 ${tag.displayName}`, `用于本地验收：${tag.displayName}`, "UserTag", grant.id);

  return grant;
}

async function ensureNotification(
  userId: string,
  type: "ANNOUNCEMENT_NEW" | "POST_COMMENT" | "PROJECT_NODE_NEW" | "TAG_GRANTED",
  title: string,
  content: string,
  relatedType: string,
  relatedId: string,
) {
  const existing = await prisma.notification.findFirst({
    where: { userId, type, relatedType, relatedId, title },
  });
  if (existing) return existing;

  return prisma.notification.create({
    data: { userId, type, title, content, relatedType, relatedId },
  });
}

async function ensureProject(leadId: string) {
  const name = "图像识别误检分析项目";
  const description =
    "用于人工审查项目 commit tree 的测试项目：围绕低照度图像识别误检、数据清洗、模型基线和复核流程展开。";
  const existing = await prisma.project.findFirst({ where: { name } });

  if (existing) {
    return prisma.project.update({
      where: { id: existing.id },
      data: {
        description,
        creatorId: leadId,
        status: "IN_PROGRESS",
        deletedAt: null,
        archivedAt: null,
      },
    });
  }

  const project = await prisma.project.create({
    data: {
      name,
      description,
      status: "IN_PROGRESS",
      creatorId: leadId,
      members: { create: { userId: leadId } },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: leadId,
      action: "CREATE",
      entityType: "Project",
      entityId: project.id,
      details: { fixture: true, purpose: "image-recognition-commit-tree-review" },
    },
  });

  return project;
}

async function ensureProjectTag(projectId: string, kind: "lead" | "member") {
  const templateName = kind === "lead" ? "project-lead" : "project-member";
  const template = await prisma.tagTemplate.findUniqueOrThrow({ where: { name: templateName }, select: { id: true } });
  const permissions =
    kind === "lead"
      ? [
          PERMISSIONS.PROJECT_MANAGE,
          PERMISSIONS.PROJECT_MEMBER_MANAGE,
          PERMISSIONS.PROJECT_NODE_CREATE,
          PERMISSIONS.ANNOUNCEMENT_CREATE,
          PERMISSIONS.ANNOUNCEMENT_NOTIFY_TARGETED,
        ]
      : [PERMISSIONS.PROJECT_NODE_CREATE];

  return prisma.tag.upsert({
    where: { name: `${templateName}:${projectId}` },
    update: {
      displayName: kind === "lead" ? "图像识别项目组长" : "图像识别项目组员",
      description: kind === "lead" ? "图像识别项目的项目级组长权限。" : "图像识别项目的项目级成员权限。",
      scope: "PROJECT",
      templateId: template.id,
      isSystem: true,
      permissions,
    },
    create: {
      name: `${templateName}:${projectId}`,
      displayName: kind === "lead" ? "图像识别项目组长" : "图像识别项目组员",
      description: kind === "lead" ? "图像识别项目的项目级组长权限。" : "图像识别项目的项目级成员权限。",
      scope: "PROJECT",
      templateId: template.id,
      isSystem: true,
      permissions,
    },
  });
}

async function ensureProjectMember(projectId: string, userId: string, actorId: string, kind: "lead" | "member") {
  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: { userId, projectId },
    update: {},
  });

  const tag = await ensureProjectTag(projectId, kind);
  const existingGrant = await prisma.userTag.findFirst({
    where: {
      userId,
      tagId: tag.id,
      projectId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (existingGrant) return existingGrant;

  const grant = await prisma.userTag.create({
    data: { userId, tagId: tag.id, projectId, grantedById: actorId },
  });
  await prisma.auditLog.create({
    data: {
      userId: actorId,
      action: "TAG_GRANT",
      entityType: "UserTag",
      entityId: grant.id,
      details: { fixture: true, projectId, projectRole: kind },
    },
  });
  await ensureNotification(userId, "TAG_GRANTED", "加入图像识别项目", tag.displayName, "PROJECT", projectId);
  return grant;
}

async function ensureProjectNode(input: {
  projectId: string;
  authorId: string;
  title: string;
  description: string;
  nodeType: "MILESTONE" | "UPDATE" | "DECISION" | "ISSUE" | "RESOURCE";
  parentId?: string;
  createdAt: Date;
}) {
  const existing = await prisma.projectNode.findFirst({
    where: { projectId: input.projectId, title: input.title },
  });

  const data = {
    projectId: input.projectId,
    authorId: input.authorId,
    parentId: input.parentId,
    title: input.title,
    description: input.description,
    nodeType: input.nodeType,
    createdAt: input.createdAt,
    deletedAt: null,
  };

  const node = existing ? await prisma.projectNode.update({ where: { id: existing.id }, data }) : await prisma.projectNode.create({ data });

  await prisma.auditLog.create({
    data: {
      userId: input.authorId,
      action: "CREATE",
      entityType: "ProjectNode",
      entityId: node.id,
      details: { fixture: true, projectId: input.projectId, nodeType: input.nodeType },
    },
  });

  return node;
}

async function ensurePost(input: {
  authorId: string;
  title: string;
  content: string;
  category: "GENERAL" | "EXPERIENCE" | "TUTORIAL" | "DISCUSSION" | "RESOURCE";
  tags: string[];
  createdAt: Date;
}) {
  const existing = await prisma.post.findFirst({ where: { title: input.title } });
  const data = {
    authorId: input.authorId,
    title: input.title,
    content: input.content,
    category: input.category,
    tags: input.tags,
    createdAt: input.createdAt,
    deletedAt: null,
  };
  const post = existing ? await prisma.post.update({ where: { id: existing.id }, data }) : await prisma.post.create({ data });

  await prisma.auditLog.create({
    data: {
      userId: input.authorId,
      action: "CREATE",
      entityType: "Post",
      entityId: post.id,
      details: { fixture: true, title: input.title },
    },
  });

  return post;
}

async function ensureComment(input: {
  postId: string;
  authorId: string;
  postAuthorId: string;
  content: string;
  parentId?: string;
  createdAt: Date;
}) {
  const existing = await prisma.comment.findFirst({
    where: { postId: input.postId, authorId: input.authorId, content: input.content },
  });
  const data = {
    postId: input.postId,
    authorId: input.authorId,
    parentId: input.parentId,
    content: input.content,
    createdAt: input.createdAt,
    deletedAt: null,
  };
  const comment = existing ? await prisma.comment.update({ where: { id: existing.id }, data }) : await prisma.comment.create({ data });

  await prisma.auditLog.create({
    data: {
      userId: input.authorId,
      action: "CREATE",
      entityType: "Comment",
      entityId: comment.id,
      details: { fixture: true, postId: input.postId },
    },
  });
  if (input.postAuthorId !== input.authorId) {
    await ensureNotification(input.postAuthorId, "POST_COMMENT", "帖子收到新评论", input.content, "POST", input.postId);
  }
  return comment;
}

async function ensureProgressReport(input: {
  userId: string;
  studySummary: string;
  projectSummary: string;
  thesisSummary: string;
  otherWork: string;
  externalDays: number;
  status: "DRAFT" | "SUBMITTED";
}) {
  const existing = await prisma.progressReport.findFirst({ where: { userId: input.userId, year, month } });
  const data = {
    studySummary: input.studySummary,
    projectSummary: input.projectSummary,
    thesisSummary: input.thesisSummary,
    otherWork: input.otherWork,
    externalDays: input.externalDays,
    status: input.status,
    submittedAt: input.status === "SUBMITTED" ? utcDate(24, 10) : null,
    deletedAt: null,
  };

  const report = existing
    ? await prisma.progressReport.update({ where: { id: existing.id }, data })
    : await prisma.progressReport.create({ data: { userId: input.userId, year, month, ...data } });

  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: "UPDATE",
      entityType: "ProgressReport",
      entityId: report.id,
      details: { fixture: true, year, month, status: input.status },
    },
  });

  return report;
}

async function ensureAnnouncement(authorId: string, recipientIds: string[]) {
  const title = "组会通知：图像识别项目误检样例复盘";
  const content =
    "请项目组在本周五组会前阅读 commit tree 中的数据清洗和夜间场景误检节点，发帖测试成员可在讨论区补充复现实验问题。";
  const existing = await prisma.announcement.findFirst({ where: { authorId, title } });
  const announcement =
    existing ??
    (await prisma.announcement.create({
      data: {
        authorId,
        title,
        content,
        targetType: "ALL",
        isPinned: true,
      },
    }));

  if (existing) {
    await prisma.announcement.update({
      where: { id: existing.id },
      data: { content, targetType: "ALL", isPinned: true, deletedAt: null },
    });
  } else {
    await prisma.auditLog.create({
      data: {
        userId: authorId,
        action: "CREATE",
        entityType: "Announcement",
        entityId: announcement.id,
        details: { fixture: true, recipientCount: recipientIds.length },
      },
    });
  }

  for (const recipientId of recipientIds) {
    await ensureNotification(recipientId, "ANNOUNCEMENT_NEW", title, content, "ANNOUNCEMENT", announcement.id);
  }

  return announcement;
}

function requireActor(actors: Map<string, FixtureUser>, username: string) {
  const actor = actors.get(username);
  if (!actor) throw new Error(`Missing fixture actor: ${username}`);
  return actor;
}

async function main() {
  const admin = await ensureAdmin();
  const memberPasswordHash = await bcrypt.hash(fixturePassword, 12);
  const actors = new Map<string, FixtureUser>();

  for (const spec of actorSpecs) {
    const user = await ensureMember(spec, memberPasswordHash, admin.id);
    actors.set(spec.username, user);
    for (const tagName of spec.tags) {
      await ensureGlobalTagGrant(user.id, tagName, admin.id);
    }
  }

  const master = requireActor(actors, "e2e-master");
  const phd = requireActor(actors, "e2e-phd");
  const advisor = requireActor(actors, "e2e-advisor");
  const progressMgr = requireActor(actors, "e2e-progress-mgr");
  const visionLead = requireActor(actors, "e2e-vision-lead");
  const visionMemberA = requireActor(actors, "e2e-vision-member-a");
  const visionMemberB = requireActor(actors, "e2e-vision-member-b");

  await prisma.user.updateMany({
    where: { username: { in: ["e2e-master", "e2e-phd", "e2e-progress-mgr", "e2e-vision-lead", "e2e-vision-member-a", "e2e-vision-member-b"] } },
    data: { advisorId: advisor.id },
  });

  const project = await ensureProject(visionLead.id);
  await ensureProjectMember(project.id, visionLead.id, admin.id, "lead");
  await ensureProjectMember(project.id, visionMemberA.id, admin.id, "member");
  await ensureProjectMember(project.id, visionMemberB.id, admin.id, "member");

  const rootNode = await ensureProjectNode({
    projectId: project.id,
    authorId: visionLead.id,
    title: "需求冻结：明确图像识别 commit tree 的验收范围",
    description:
      "项目组长确认本轮验收只覆盖低照度图像识别误检、数据清洗记录、模型基线选择和人工复核闭环，方便人工审查时沿着树状节点追踪每一次提交的意图。",
    nodeType: "MILESTONE",
    createdAt: utcDate(3, 2),
  });
  const baselineNode = await ensureProjectNode({
    projectId: project.id,
    authorId: visionLead.id,
    parentId: rootNode.id,
    title: "模型基线选择：先用 ResNet50 复现实验",
    description:
      "组长记录选择 ResNet50 的原因：训练速度稳定、已有实验日志可复用，先建立可比较的误检基线，再讨论是否切换到更重的检测模型。",
    nodeType: "DECISION",
    createdAt: utcDate(5, 3),
  });
  const cleaningNode = await ensureProjectNode({
    projectId: project.id,
    authorId: visionMemberA.id,
    parentId: rootNode.id,
    title: "数据清洗：剔除 136 张重复和模糊样本",
    description:
      "组员林知夏说明清洗规则：保留同一场景中光照差异明显的样本，删除完全重复、严重失焦和标注框偏移超过目标宽度一半的图片。",
    nodeType: "UPDATE",
    createdAt: utcDate(8, 4),
  });
  const nightIssueNode = await ensureProjectNode({
    projectId: project.id,
    authorId: visionMemberB.id,
    parentId: cleaningNode.id,
    title: "问题定位：夜间场景误检集中在反光标志",
    description:
      "组员周子衿复核了 40 张夜间错误样例，发现模型把反光路牌和实验室玻璃反射误判为目标设备，需要在下一轮加入亮度归一化和困难样本备注。",
    nodeType: "ISSUE",
    createdAt: utcDate(11, 5),
  });
  await ensureProjectNode({
    projectId: project.id,
    authorId: visionMemberA.id,
    parentId: nightIssueNode.id,
    title: "修复提交：加入亮度归一化和困难样本备注",
    description:
      "在数据预处理脚本中加入亮度归一化开关，并在人工复核表中给每张困难样本补充一句自然语言说明，方便导师快速判断误检是否合理。",
    nodeType: "UPDATE",
    createdAt: utcDate(14, 6),
  });
  await ensureProjectNode({
    projectId: project.id,
    authorId: visionLead.id,
    parentId: baselineNode.id,
    title: "资料归档：基线日志、复核表和下一轮实验计划",
    description:
      "组长把基线训练日志、人工复核清单和下一轮消融实验计划统一归档，供项目成员继续在 commit tree 下追加节点。",
    nodeType: "RESOURCE",
    createdAt: utcDate(18, 7),
  });

  const masterPost = await ensurePost({
    authorId: master.id,
    title: "文献精读：弱监督图像标注在实验室数据里的三个坑",
    content:
      "我整理了本周读到的弱监督标注经验。第一，标签噪声不是均匀分布，夜间图像里的反光区域最容易带来错误监督；第二，人工复核不能只看准确率，需要记录每个误检样例背后的场景原因；第三，讨论区里如果能把失败样例讲清楚，后续项目节点会更容易追踪。",
    category: "EXPERIENCE",
    tags: ["发帖测试", "研究生", "文献阅读"],
    createdAt: utcDate(6, 2),
  });
  const phdPost = await ensurePost({
    authorId: phd.id,
    title: "实验记录：低照度图像预处理的复现实验",
    content:
      "我把低照度图片按亮度分桶后重新跑了一次预处理。初步结论是，简单直方图均衡会提升可见度，但也会放大玻璃反光；如果要进入项目 commit tree，建议每个参数组合都附带一段人工观察记录，而不是只贴指标。",
    category: "TUTORIAL",
    tags: ["发帖测试", "博士", "实验复现"],
    createdAt: utcDate(9, 3),
  });
  const advisorPost = await ensurePost({
    authorId: advisor.id,
    title: "导师提醒：图像识别项目本周优先看误检样例",
    content:
      "本周发帖区请优先围绕误检样例展开。大家评论时尽量写清楚样例来源、现象、猜测原因和下一步验证动作，这样我人工审查测试数据时可以直接判断讨论是否有上下文。",
    category: "DISCUSSION",
    tags: ["发帖测试", "导师", "组会"],
    createdAt: utcDate(10, 4),
  });

  const masterComment = await ensureComment({
    postId: masterPost.id,
    authorId: phd.id,
    postAuthorId: master.id,
    content: "这条文献整理很适合接到 commit tree：我建议把“夜间反光”单独建成问题节点，后面每次修复都挂在这个节点下面。",
    createdAt: utcDate(6, 8),
  });
  await ensureComment({
    postId: masterPost.id,
    authorId: advisor.id,
    postAuthorId: master.id,
    parentId: masterComment.id,
    content: "同意。回复里这类自然语言判断比单纯贴指标更有审查价值，后续请保留样例编号和现场描述。",
    createdAt: utcDate(6, 9),
  });
  await ensureComment({
    postId: phdPost.id,
    authorId: visionLead.id,
    postAuthorId: phd.id,
    content: "我会把这组预处理结论同步到项目树的基线节点下，尤其是直方图均衡放大反光的问题。",
    createdAt: utcDate(9, 10),
  });
  await ensureComment({
    postId: advisorPost.id,
    authorId: visionMemberA.id,
    postAuthorId: advisor.id,
    content: "我负责把重复和模糊样本清洗规则写进项目节点，避免人工审查时只看到一串提交标题。",
    createdAt: utcDate(10, 11),
  });

  await ensureProgressReport({
    userId: master.id,
    studySummary: "完成弱监督标注文献精读两篇，重点记录标签噪声和人工复核流程。",
    projectSummary: "参与讨论低照度图像误检样例，补充了三条发帖区问题描述。",
    thesisSummary: "整理开题相关的图像识别评价指标，准备与导师确认章节结构。",
    otherWork: "协助同门检查数据集命名是否一致。",
    externalDays: 0,
    status: "SUBMITTED",
  });
  await ensureProgressReport({
    userId: phd.id,
    studySummary: "复现低照度预处理实验，比较直方图均衡和亮度归一化的差异。",
    projectSummary: "把实验观察写成教程帖，并准备接入图像识别项目的基线节点。",
    thesisSummary: "补充实验设计章节中关于失败样例分析的段落。",
    otherWork: "协助研究生理解复现实验日志。",
    externalDays: 1,
    status: "SUBMITTED",
  });
  await ensureProgressReport({
    userId: progressMgr.id,
    studySummary: "梳理 2026 年 6 月进度报告字段，确认导出表中导师、学号和项目总结都能读到。",
    projectSummary: "检查多名成员的报告状态，准备使用导出功能生成 Excel 给导师复核。",
    thesisSummary: "整理博士阶段月度管理流程说明。",
    otherWork: "负责打开补填窗口和核对缺交名单。",
    externalDays: 0,
    status: "SUBMITTED",
  });
  await ensureProgressReport({
    userId: visionLead.id,
    studySummary: "阅读图像识别误检分析论文，确认项目基线和问题拆解方式。",
    projectSummary: "创建图像识别误检分析项目，维护项目组长节点、模型基线节点和资料归档节点。",
    thesisSummary: "把 commit tree 的节点结构映射到论文实验记录模板。",
    otherWork: "组织两名项目组员分工清洗数据和复核夜间样例。",
    externalDays: 0,
    status: "SUBMITTED",
  });
  await ensureProgressReport({
    userId: visionMemberA.id,
    studySummary: "学习数据清洗规则和标注质量评估方法。",
    projectSummary: "完成 136 张重复和模糊样本剔除，并在项目树下记录清洗规则。",
    thesisSummary: "暂无论文正文更新，主要投入项目数据准备。",
    otherWork: "整理人工复核表字段。",
    externalDays: 0,
    status: "SUBMITTED",
  });
  await ensureProgressReport({
    userId: visionMemberB.id,
    studySummary: "学习夜间场景误检分析方法，重点关注反光和低对比度问题。",
    projectSummary: "复核 40 张夜间错误样例，定位反光标志误检集中出现的问题。",
    thesisSummary: "准备把误检样例写入后续实验分析材料。",
    otherWork: "等待下一轮亮度归一化实验结果。",
    externalDays: 0,
    status: "DRAFT",
  });

  await ensureAnnouncement(
    advisor.id,
    [master, phd, progressMgr, visionLead, visionMemberA, visionMemberB].map((actor) => actor.id),
  );

  console.log(
    JSON.stringify(
      {
        admin: admin.username,
        adminPasswordSource: process.env.E2E_ADMIN_PASSWORD ? "E2E_ADMIN_PASSWORD" : process.env.ADMIN_PASSWORD ? "ADMIN_PASSWORD" : "E2E_FIXTURE_PASSWORD",
        fixturePasswordSet: Boolean(fixturePassword),
        actors: Object.fromEntries(Array.from(actors.entries()).map(([username, user]) => [username, user.id])),
        project: { id: project.id, name: project.name },
        posts: [masterPost.title, phdPost.title, advisorPost.title],
        progressPeriod: `${year}-${String(month).padStart(2, "0")}`,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
