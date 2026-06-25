"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertPermissionWithAudit } from "@/shared/lib/authorization";
import { getEffectiveTags, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { ADVISOR_TAG_NAME } from "@/shared/lib/system-tags";
import { projectInputSchema } from "@/shared/lib/validators/projects";

import { resolveProjectCreationAssignments } from "../lib/create-project";
import { hasGlobalAdvisorTag } from "../lib/visibility";
import { grantProjectScopedTag } from "../lib/tag-grants";

export async function createProject(input: unknown) {
  const user = await requireActiveUser();
  const data = projectInputSchema.parse(input);

  await assertPermissionWithAudit({
    userId: user.id,
    permission: PERMISSIONS.PROJECT_CREATE,
    entityType: "Project",
  });

  const effectiveTags = await getEffectiveTags(user.id);
  const creatorIsAdvisor = hasGlobalAdvisorTag({ tags: effectiveTags });
  const assignments = resolveProjectCreationAssignments({
    creatorUserId: user.id,
    leadUserId: data.leadUserId,
    memberUserIds: data.memberUserIds,
    excludeCreatorFromLead: creatorIsAdvisor,
    excludeCreatorFromMembers: creatorIsAdvisor,
  });
  const advisorId = creatorIsAdvisor ? user.id : data.advisorId;

  const project = await prisma.$transaction(async (tx) => {
    const participantIds = [assignments.leadUserId, ...assignments.memberUserIds];
    const participants = await tx.user.findMany({
      where: { id: { in: participantIds }, status: "ACTIVE" },
      select: { id: true },
    });
    if (participants.length !== new Set(participantIds).size) {
      throw new Error("项目组长或成员不存在，或账号不可用。");
    }

    if (advisorId) {
      const now = new Date();
      await tx.user.findFirstOrThrow({
        where: {
          id: advisorId,
          status: "ACTIVE",
          tags: {
            some: {
              revokedAt: null,
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              tag: { name: ADVISOR_TAG_NAME },
            },
          },
        },
        select: { id: true },
      });
    }

    const project = await tx.project.create({
      data: {
        name: data.name,
        description: data.description,
        creatorId: user.id,
        advisorId: advisorId ?? null,
      },
    });

    await grantProjectScopedTag(tx, {
      kind: "lead",
      userId: assignments.leadUserId,
      projectId: project.id,
      projectName: project.name,
      grantedById: user.id,
    });

    for (const memberUserId of assignments.memberUserIds) {
      await grantProjectScopedTag(tx, {
        kind: "member",
        userId: memberUserId,
        projectId: project.id,
        projectName: project.name,
        grantedById: user.id,
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entityType: "Project",
        entityId: project.id,
        details: {
          leadUserId: assignments.leadUserId,
          memberUserIds: assignments.memberUserIds,
          advisorId: advisorId ?? null,
        },
      },
    });

    return project;
  });

  revalidatePath("/projects");
  return project;
}

export type ProjectFormState = { ok: boolean; message: string | null };

export async function createProjectFormAction(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  let projectId: string;
  try {
    const project = await createProject({
      name: formData.get("name"),
      description: formData.get("description"),
      leadUserId: formData.get("leadUserId"),
      memberUserIds: formData.getAll("memberUserIds").map(String).filter(Boolean),
      advisorId: formData.get("advisorId") || undefined,
    });
    projectId = project.id;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "创建失败" };
  }
  // redirect() throws, so it must run outside the try/catch.
  redirect(`/projects/${projectId}`);
}
