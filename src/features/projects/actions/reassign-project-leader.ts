"use server";

import { revalidatePath } from "next/cache";

import { auditPermissionDenied } from "@/shared/lib/audit";
import { getUserPermissionsForClient, PERMISSIONS, PermissionDeniedError } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { lockUserLifecycle, orderUserLifecycleLockIds } from "@/shared/lib/user-lifecycle-lock";
import { projectLeaderReassignmentInputSchema } from "@/shared/lib/validators/projects";
import { toActionResult } from "@/shared/lib/action-result";

import { canManageProjectLeaderReassignment } from "../lib/project-governance";
import { assignProjectLeader, lockProjectLeaderAssignment } from "../lib/project-state-service";
import { assertProjectWritableStatus, PROJECT_ARCHIVED_WRITE_MESSAGE } from "../lib/writable";

const PROJECT_LEADER_REASSIGNMENT_NOT_NEEDED = "项目当前无需重新分配负责人。";
const PROJECT_LEADER_REASSIGNMENT_COMPLETED = "已完成项目无需重新分配负责人。";
const projectLeaderReassignmentMessages = [
  PROJECT_LEADER_REASSIGNMENT_NOT_NEEDED,
  PROJECT_LEADER_REASSIGNMENT_COMPLETED,
  PROJECT_ARCHIVED_WRITE_MESSAGE,
  "项目组长必须是负责导师的直属在读硕士或博士成员。",
  "执行项目负责人变更的账号已失效。",
] as const;

export async function reassignProjectLeader(input: unknown) {
  const actor = await requireActiveUser();
  const data = projectLeaderReassignmentInputSchema.parse(input);

  try {
    await prisma.$transaction(async (tx) => {
      for (const userId of orderUserLifecycleLockIds([actor.id, data.leaderId])) {
        await lockUserLifecycle(tx, userId);
      }
      await lockProjectLeaderAssignment(tx, data.projectId);
      const [[{ now }], project, currentActor] = await Promise.all([
        tx.$queryRaw<Array<{ now: Date }>>`SELECT transaction_timestamp() AS now`,
        tx.project.findFirstOrThrow({
          where: { id: data.projectId, deletedAt: null },
          select: {
            advisorId: true,
            status: true,
            leaderNeedsReassignment: true,
            deletedAt: true,
          },
        }),
        tx.user.findUnique({
          where: { id: actor.id },
          select: { role: true, status: true },
        }),
      ]);
      const globalPermissions = await getUserPermissionsForClient(tx, actor.id, now);
      if (
        !currentActor
        || currentActor.status !== "ACTIVE"
        || !canManageProjectLeaderReassignment(actor.id, currentActor.role, project, globalPermissions)
      ) {
        throw new PermissionDeniedError(PERMISSIONS.PROJECT_UPDATE_ADVISED);
      }
      if (!project.leaderNeedsReassignment) throw new Error(PROJECT_LEADER_REASSIGNMENT_NOT_NEEDED);
      if (project.status === "COMPLETED") throw new Error(PROJECT_LEADER_REASSIGNMENT_COMPLETED);
      assertProjectWritableStatus(project.status);
      await assignProjectLeader(tx, {
        projectId: data.projectId,
        leaderId: data.leaderId,
        actorId: actor.id,
      });
    });
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await auditPermissionDenied({
        userId: actor.id,
        permission: error.permission,
        entityType: "ProjectLeader",
        entityId: data.projectId,
      });
    }
    throw error;
  }

  revalidatePath(`/projects/${data.projectId}`);
  revalidatePath("/projects");
}

export type ProjectLeaderReassignmentState = { ok: boolean; message: string | null };

export async function reassignProjectLeaderFormAction(
  _previous: ProjectLeaderReassignmentState,
  formData: FormData,
): Promise<ProjectLeaderReassignmentState> {
  const result = await toActionResult(async () => {
    await reassignProjectLeader({
      projectId: formData.get("projectId"),
      leaderId: formData.get("leaderId"),
    });
    return null;
  }, {
    fallbackMessage: "项目负责人重新分配失败，请稍后重试。",
    knownMessages: projectLeaderReassignmentMessages,
  });
  return result.ok ? { ok: true, message: "项目负责人已重新分配" } : result;
}
