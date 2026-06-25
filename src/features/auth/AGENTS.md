<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# auth (feature)

## Purpose
Client-facing authentication UI and the change-password server action. The heavy auth logic (credential verification, lockout, session callbacks) lives in `@/shared/lib/auth`; this slice is the forms plus the password-change mutation that bumps `tokenVersion` to revoke old sessions.

## Key Files
| File | Description |
|------|-------------|
| `components/login-form.tsx` | Credentials login form (calls NextAuth `signIn`) |
| `components/change-password-form.tsx` | Forced/voluntary password change form |
| `actions/change-password.ts` | Server action: validates new password (`validatePasswordPolicy`), updates hash, clears `mustChangePassword`, increments `tokenVersion` (revokes sessions), audits `PASSWORD_CHANGE` |
| `index.ts` | Barrel export |

## For AI Agents

### Working In This Directory
- New passwords must pass `validatePasswordPolicy` from `@/shared/lib/security` with the user's identity values (username, studentId) excluded — keep this server-side.
- A successful change must increment `tokenVersion` and write an audit row; this is what logs the user out everywhere and forces re-login.
- The `/change-password` page is reachable while `mustChangePassword` is true via `requireActiveUser({ allowPasswordChange: true })` — don't tighten the gate so users get locked out of fixing their own password.

### Testing Requirements
- Covered indirectly by `tests/security.test.ts` (password policy) and `tests/login-security.test.ts`. Run `npm run verify`.

## Dependencies

### Internal
- `@/shared/lib/security`, `@/shared/lib/session`, `@/shared/lib/auth` (`signIn`), `@/shared/lib/validators/auth`, `@/shared/lib/prisma`, `@/shared/lib/audit`.

### External
- NextAuth client, React, bcryptjs (via shared security).

<!-- MANUAL: -->
