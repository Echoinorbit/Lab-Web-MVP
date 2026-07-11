import type { ActionResult } from "@/shared/lib/action-result";
import { toActionResult } from "@/shared/lib/action-result";

const userActionFeedbackMessages = [
  "管理员不能停用、毕业或删除自己的账号。",
  "管理员不能删除自己的账号。",
  "管理员不能移除自己的管理员角色。",
  "用户不存在。",
  "用户不存在或已被删除。",
  "用户角色未发生变化。",
  "毕业账号不能直接变更系统角色。",
  "请先使用取消毕业流程恢复该账号。",
  "请先取消毕业，再修改培养身份。",
  "不能移除最后一个有效管理员的角色。",
  "不能停用最后一个有效管理员账号。",
  "不能删除最后一个有效管理员账号。",
  "确认用户名不匹配。",
  "执行角色变更的管理员账号已失效。",
  "执行状态变更的管理员账号已失效。",
  "执行身份信息变更的管理员账号已失效。",
  "执行培养身份变更的管理员账号已失效。",
  "执行导师变更的管理员账号已失效。",
  "执行会话吊销的管理员账号已失效。",
  "执行删除的管理员账号已失效。",
  "执行毕业操作的管理员账号已失效。",
  "执行取消毕业的管理员账号已失效。",
  "用户名已存在，请使用其他用户名。",
  "学号已存在，请检查是否重复。",
  "用户名或学号已存在，请检查后重试。",
  "仅可为在用成员设置导师。",
  "请先修复该账号的培养身份。",
  "管理员和导师账号不需要设置导师。",
  "所选导师不存在或导师资格已失效。",
  "管理员账号不能设置培养身份。",
  "只有身份已确认的硕士或博士成员可以毕业。",
  "该账号已经进入毕业清理期。",
  "该账号不在毕业清理期。",
  "该账号的培养身份不允许取消毕业。",
] as const;

export function toUserActionResult<T>(action: () => Promise<T>, fallbackMessage: string): Promise<ActionResult<T>> {
  return toActionResult(action, { fallbackMessage, knownMessages: userActionFeedbackMessages });
}
