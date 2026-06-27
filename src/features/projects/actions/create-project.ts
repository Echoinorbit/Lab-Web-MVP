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
import { assertParticipantsBelongToAdvisor, resolveProjectCreationContext } from "../lib/project-governance";
import { hasGlobalAdvisorTag } from "../lib/visibility";
import { grantProjectScopedTag } from "../lib/tag-grants";

export async function createProject(input: unknown) {
  const user = await requireActiveUser();
  const data = projectInputSchema.parse(input);

  const permission = user.role === "ADMIN"
    ? PERMISSIONS.PROJECT_CREATE_ON_BEHALF
    : PERMISSIONS.PROJECT_CREATE;
  await assertPermissionWithAudit({
    userId: user.id,
    permission,
    entityType: "Project",
  });

  const effectiveTags = await getEffectiveTags(user.id);
  const creatorIsAdvisor = user.role === "MEMBER" && hasGlobalAdvisorTag({ tags: effectiveTags });
  const creationContext = resolveProjectCreationContext({
    actorId: user.id,
    actorRole: user.role,
    actorIsAdvisor: creatorIsAdvisor,
    selectedAdvisorId: data.advisorId,
  });
  const assignments = resolveProjectCreationAssignments({
    creatorUserId: user.id,
    leadUserId: data.leadUserId,
    memberUserIds: data.memberUserIds,
    excludeCreatorFromLead: creatorIsAdvisor,
    excludeCreatorFromMembers: creatorIsAdvisor,
  });
  const advisorId = creationContext.advisorId;

  const project = await prisma.$transaction(async (tx) => {
    const participantIds = [assignments.leadUserId, ...assignments.memberUserIds];
    const participants = await tx.user.findMany({
      where: { id: { in: participantIds }, role: "MEMBER", status: "ACTIVE" },
      select: { id: true, advisorId: true },
    });
    if (participants.length !== new Set(participantIds).size) {
      throw new Error("项目组长或成员不存在，或账号不可用。");
    }

    const now = new Date();
    const advisor = await tx.user.findFirst({
      where: {
        id: advisorId,
        role: "MEMBER",
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
    if (!advisor) throw new Error("所选负责导师不存在、已停用或导师身份已失效。");
    assertParticipantsBelongToAdvisor(advisorId, participantIds, participants);

    const project = await tx.project.create({
      data: {
        name: data.name,
        description: data.description,
        creatorId: creationContext.creatorId,
        advisorId,
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
          advisorId,
          delegated: creationContext.delegated,
        },
      },
    });

    return project;
  });

  revalidatePath("/projects");
  revalidatePath("/");
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
