import { graduateUserAccount, type GraduationTransaction } from "@/shared/lib/graduation";
import { assertCanUpdateStatusFromAdminPanel, type UserStatusName } from "@/shared/lib/user-status";

export type AdminMutableUserStatus = "ACTIVE" | "SUSPENDED" | "GRADUATED";

export type AdminUserStatusTransaction = {
  user: {
    updateMany(args: {
      where: { id: string; status: { not: "GRADUATED" } };
      data: { status: AdminMutableUserStatus; tokenVersion: { increment: number } };
    }): PromiseLike<{ count: number }>;
    findUnique(args: { where: { id: string }; select: { status: true } }): PromiseLike<{ status: UserStatusName } | null>;
  };
  auditLog: {
    create(args: {
      data: {
        userId: string;
        action: "STATUS_CHANGE";
        entityType: "User";
        entityId: string;
        details: { status: AdminMutableUserStatus };
      };
    }): PromiseLike<unknown>;
  };
} & Pick<GraduationTransaction, "userTag">;

export async function applyAdminUserStatusUpdate(
  tx: AdminUserStatusTransaction,
  {
    adminId,
    userId,
    status,
  }: {
    adminId: string;
    userId: string;
    status: AdminMutableUserStatus;
  },
) {
  const now = new Date();
  const updateResult =
    status === "GRADUATED"
      ? await graduateUserAccount(tx, userId, now)
      : await tx.user.updateMany({
          where: { id: userId, status: { not: "GRADUATED" } },
          data: {
            status,
            tokenVersion: { increment: status === "SUSPENDED" ? 1 : 0 },
          },
        });

  if (updateResult.count !== 1) {
    const targetUser = await tx.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!targetUser) {
      throw new Error("用户不存在。");
    }
    assertCanUpdateStatusFromAdminPanel(targetUser.status);
    throw new Error("用户状态已变化，请刷新后重试。");
  }

  await tx.auditLog.create({
    data: {
      userId: adminId,
      action: "STATUS_CHANGE",
      entityType: "User",
      entityId: userId,
      details: { status },
    },
  });
}
