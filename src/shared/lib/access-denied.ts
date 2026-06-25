import { PermissionDeniedError } from "./permissions";

export const FORBIDDEN_ROUTE = "/403";

export function isPermissionDeniedError(error: unknown): error is PermissionDeniedError {
  return error instanceof PermissionDeniedError;
}
