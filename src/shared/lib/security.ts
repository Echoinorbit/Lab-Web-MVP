import bcrypt from "bcryptjs";

const DUMMY_HASH = "$2a$12$US9xNh13TTE35MX0G/BvuO0VqHaQJVFGj3EP4wZPpySUd8Y4MR6Ge";

export type PasswordCheck = {
  ok: boolean;
  errors: string[];
};

export function validatePasswordPolicy(password: string, identityValues: readonly string[] = []): PasswordCheck {
  const errors: string[] = [];
  if (password.length < 10) errors.push("Password must be at least 10 characters.");

  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  if (classes < 3) errors.push("Password must include at least three character classes.");

  const lower = password.toLowerCase();
  for (const value of identityValues) {
    const normalized = value.trim().toLowerCase();
    if (normalized && lower.includes(normalized)) {
      errors.push("Password must not contain username or student id.");
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}

export async function verifyPasswordWithDummyFallback(password: string, hash?: string | null) {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}
