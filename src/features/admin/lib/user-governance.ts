export function canAssignAdvisorToTarget({
  role,
  hasAdvisorTag,
}: {
  role: "ADMIN" | "MEMBER";
  hasAdvisorTag: boolean;
}) {
  return role === "MEMBER" && !hasAdvisorTag;
}

export function buildUserIdentityUpdateData(
  current: { username: string; displayName: string; studentId: string | null },
  next: { username: string; displayName: string; studentId: string | null },
) {
  return {
    username: next.username,
    displayName: next.displayName,
    studentId: next.studentId,
    ...(current.username !== next.username ? { tokenVersion: { increment: 1 } } : {}),
  };
}

export type AdminUserRoleTransaction = {
  user: {
    update(args: {
      where: { id: string };
      data: {
        role: "ADMIN" | "MEMBER";
        advisorId?: null;
        tokenVersion: { increment: number };
      };
    }): PromiseLike<unknown>;
  };
  userTag: {
    updateMany(args: {
      where: { userId: string; revokedAt: null };
      data: { revokedAt: Date; revokedById: string };
    }): PromiseLike<{ count: number }>;
  };
  auditLog: {
    create(args: {
      data: {
        userId: string;
        action: "ROLE_CHANGE";
        entityType: "User";
        entityId: string;
        details: { role: "ADMIN" | "MEMBER"; revokedTagCount: number };
      };
    }): PromiseLike<unknown>;
  };
};

export async function applyAdminUserRoleUpdate(
  tx: AdminUserRoleTransaction,
  {
    adminId,
    userId,
    role,
    now = new Date(),
  }: {
    adminId: string;
    userId: string;
    role: "ADMIN" | "MEMBER";
    now?: Date;
  },
) {
  await tx.user.update({
    where: { id: userId },
    data: {
      role,
      ...(role === "ADMIN" ? { advisorId: null } : {}),
      tokenVersion: { increment: 1 },
    },
  });

  const revokedTagCount = role === "ADMIN"
    ? (await tx.userTag.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now, revokedById: adminId },
      })).count
    : 0;

  await tx.auditLog.create({
    data: {
      userId: adminId,
      action: "ROLE_CHANGE",
      entityType: "User",
      entityId: userId,
      details: { role, revokedTagCount },
    },
  });
}
