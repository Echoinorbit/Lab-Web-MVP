export type UserStatusName = "ACTIVE" | "SUSPENDED" | "GRADUATED";

export function assertCanUpdateStatusFromAdminPanel(currentStatus: UserStatusName) {
  if (currentStatus === "GRADUATED") {
    throw new Error("已毕业用户状态需通过毕业流程管理。");
  }
}

export function resolveSessionStatus(currentStatus: UserStatusName | null | undefined, isCurrent: boolean): UserStatusName {
  if (currentStatus === "GRADUATED") return "GRADUATED";
  return isCurrent ? "ACTIVE" : "SUSPENDED";
}
