import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";

import { PermissionDeniedError } from "@/shared/lib/permissions";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

type ActionResultOptions = {
  fallbackMessage: string;
  knownMessages?: readonly string[];
};

export function getActionErrorMessage(
  error: unknown,
  { fallbackMessage, knownMessages = [] }: ActionResultOptions,
) {
  if (error instanceof PermissionDeniedError) return "没有权限执行此操作。";
  if (error instanceof ZodError) return "提交内容格式有误，请检查后重试。";
  return error instanceof Error && knownMessages.includes(error.message)
    ? error.message
    : fallbackMessage;
}

export async function toActionResult<T>(
  action: () => Promise<T>,
  { fallbackMessage, knownMessages = [] }: ActionResultOptions,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await action() };
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, message: getActionErrorMessage(error, { fallbackMessage, knownMessages }) };
  }
}
