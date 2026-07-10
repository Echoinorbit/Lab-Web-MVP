import { prisma } from "@/shared/lib/prisma";

export const PROJECT_ARCHIVED_WRITE_MESSAGE = "已归档项目不可写入。";

export function assertProjectWritableStatus(status: string) {
  if (status === "ARCHIVED") {
    throw new Error(PROJECT_ARCHIVED_WRITE_MESSAGE);
  }
}

export async function assertProjectWritable(projectId: string) {
  const project = await prisma.project.findFirstOrThrow({
    where: { id: projectId, deletedAt: null },
    select: { status: true },
  });
  assertProjectWritableStatus(project.status);
}
