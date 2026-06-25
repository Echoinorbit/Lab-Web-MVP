import bcrypt from "bcryptjs";

const DUMMY_HASH = "$2a$12$US9xNh13TTE35MX0G/BvuO0VqHaQJVFGj3EP4wZPpySUd8Y4MR6Ge";

export type PasswordCheck = {
  ok: boolean;
  errors: string[];
};

export function validatePasswordPolicy(password: string, identityValues: readonly string[] = []): PasswordCheck {
  const errors: string[] = [];
  if (password.length < 10) errors.push("密码至少需要 10 位。");

  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  if (classes < 3) errors.push("密码必须包含大小写字母、数字、符号中的至少三类。");

  const lower = password.toLowerCase();
  for (const value of identityValues) {
    const normalized = value.trim().toLowerCase();
    if (normalized && lower.includes(normalized)) {
      errors.push("密码不能包含用户名或学号。");
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function verifyPasswordWithDummyFallback(password: string, hash?: string | null) {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}
