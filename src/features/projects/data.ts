import type { ProjectStatus } from "@prisma/client";

export type ProjectSummary = {
  id: string;
  name: string;
  status: ProjectStatus;
  memberCount: number;
  nodeCount: number;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  milestones: readonly ProjectMilestone[];
  deletedAt?: string | null;
};

export type ProjectMilestone = {
  id: string;
  title: string;
  createdAt: string;
  colorHex: string | null;
};

type ProjectListRecord = {
  id: string;
  name: string;
  status: ProjectStatus;
  description: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  nodes: Array<{
    id: string;
    title: string;
    createdAt: Date;
    colorHex: string | null;
  }>;
  _count: { members: number; nodes: number };
};

export const projectStatusLabels: Record<ProjectStatus, string> = {
  PLANNING: "规划中",
  IN_PROGRESS: "进行中",
  REVIEW: "评审中",
  COMPLETED: "已完成",
  ARCHIVED: "已归档",
};

/**
 * Presentation data seam for the project browser. The route retains its
 * permission-scoped Prisma query; replacing this adapter is the only view
 * data change needed when that query moves behind an API.
 */
export async function getProjects(records: readonly ProjectListRecord[]): Promise<ProjectSummary[]> {
  return records.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status,
    memberCount: project._count.members,
    nodeCount: project._count.nodes,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    archivedAt: project.archivedAt?.toISOString() ?? null,
    milestones: project.nodes.map((node) => ({
      id: node.id,
      title: node.title,
      createdAt: node.createdAt.toISOString(),
      colorHex: node.colorHex,
    })),
    deletedAt: project.deletedAt?.toISOString() ?? null,
  }));
}
