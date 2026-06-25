<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# tests

## Purpose
Pure-unit test suites that lock in the platform's security-critical invariants. They run on the Node built-in test runner (`node --test`) via `tsx`, with no database — they exercise the deterministic, side-effect-free helpers (snapshot-based permission/session computation, password policy, rate-limit selection, date windows, validators).

## Key Files
| File | Description |
|------|-------------|
| `login-security.test.ts` | Login flow guards: lockout, IP failure limiting, dummy-hash timing fallback |
| `permissions.test.ts` | `computePermissionsFromSnapshot` / project-scoped permission computation, tag expiry/revocation |
| `session.test.ts` | `isSessionCurrent` revocation logic (status + `tokenVersion`) |
| `rate-limits.test.ts` | `selectRateLimit` tag-based limit selection (unlimited/limited/denied) |
| `progress-window.test.ts` | Shanghai-timezone report window (25–27) and backfill expiry rules |
| `security.test.ts` | `validatePasswordPolicy` (length, character classes, identity exclusion) |
| `validators.test.ts` | Zod schemas in `src/shared/lib/validators/` |

## For AI Agents

### Working In This Directory
- Run with `npm run test` (matches `tests/*.test.ts`); included in `npm run verify`.
- Tests import pure functions from `@/shared/...`. Keep them DB-free: test the `*FromSnapshot`/`select*`/`is*` pure helpers, not the `async` Prisma wrappers.
- When you change any security helper (permissions, session, auth security, rate-limits, date windows, validators), add or update the matching test in the same PR — these suites are the guardrails for the architecture's invariants.

### Common Patterns
- `node:test` (`describe`/`it`) + `node:assert/strict`. No mocking framework; construct plain snapshot objects as inputs.

## Dependencies

### Internal
- `src/shared/lib/*` (permissions, session, security, rate-limits, date) and `src/shared/lib/validators/*`.

### External
- Node test runner, `tsx` (TypeScript execution via `--import tsx`).

<!-- MANUAL: -->
