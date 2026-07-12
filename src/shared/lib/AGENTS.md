<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# lib

## Purpose
The security and persistence core of the platform. Authentication, the dynamic permission engine, DB-backed session revocation, audit logging, rate limiting, timezone-aware date windows, and password policy all live here. Most modules expose a **pure** snapshot/selection helper (unit-tested, DB-free) plus an `async` wrapper that loads data from Prisma.

## Key Files
| File | Description |
|------|-------------|
| `prisma.ts` | Singleton `PrismaClient` (the only DB entry point) |
| `auth.ts` | NextAuth config: Credentials provider, login lockout, IP failure limiting, dummy-hash timing defense, JWT/session callbacks that re-validate `tokenVersion` and attach `permissions`/`tags`. Exports `auth`, `signIn`, `signOut`, `handlers` |
| `session.ts` | `requireActiveUser()` (server gate: redirects on missing/revoked session or `mustChangePassword`) and the pure `isSessionCurrent` |
| `permissions.ts` | `PERMISSIONS` catalog, `ROLE_PERMISSIONS`, pure `compute*FromSnapshot` (global + project-scoped), and `getUserPermissions`/`getProjectPermissions`/`assertPermission`/`assertProjectPermission` + `PermissionDeniedError` |
| `authorization.ts` | `assertPermissionWithAudit` / `assertProjectPermissionWithAudit` / `requirePermission` — wrap permission checks and write a `PERMISSION_DENIED` audit row on failure |
| `audit.ts` | `appendAuditLog` and helpers (e.g. `auditPermissionDenied`) for the `AuditLog` table |
| `rate-limits.ts` | `RATE_LIMITS` table, pure `selectRateLimit` (tag-based unlimited/limited/denied), transactional `enforceRateLimit`, and read-only `getRateLimitStatus` |
| `security.ts` | `validatePasswordPolicy` (≥10 chars, ≥3 classes, no identity substring) and `verifyPasswordWithDummyFallback` (constant-work bcrypt compare) |
| `date.ts` | Asia/Shanghai date logic: persisted report-window evaluation, period helpers, backfill expiry (24h), and daily counter boundaries |
| `system-settings.ts` | Singleton persisted progress-window/session-duration validation and constants |
| `study-identity.ts` | Canonical degree/grade combinations and degree-Tag projection helpers |
| `project-status.ts` | Pure project state derivation with archive/completion priority |
| `actor-snapshot.ts` | Bounded historical identity snapshots used before nullable actor relations are cleared |
| `user-lifecycle-lock.ts` | Stable per-user PostgreSQL transaction lock plus the locked active-actor/snapshot loader used by mutations |
| `avatar-storage.ts` | Managed 512×512 PNG validation, atomic storage, safe removal, and orphan cleanup |
| `utils.ts` | `cn` class-merge helper and small utilities |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `validators/` | Zod input schemas: `auth.ts`, `announcements.ts`, `progress.ts`, `projects.ts` |

## For AI Agents

### Working In This Directory
- **Authorization is server-side only.** Never gate solely on the client session or middleware. Server actions/pages must call `requireActiveUser()` then `assertPermissionWithAudit` (or the `*Project*` variant for `projectId`-scoped Tags).
- **Project Tags must not cross projects.** Use `getProjectPermissions(userId, projectId)` / `assertProjectPermission` — the global `getUserPermissions` deliberately ignores project-scoped tags.
- **Session revocation is `tokenVersion`-based.** Bumping `User.tokenVersion` invalidates all live sessions; the `auth.ts` session callback and `isSessionCurrent` both re-check it against the DB on every request.
- Keep login-failure handling constant-work: always run a bcrypt compare (real hash or `DUMMY_HASH`) even on unknown users / rate-limited IPs to avoid timing leaks.
- Effective Tag = `revokedAt == null` AND (`expiresAt == null` OR `expiresAt > now`). Reuse `isEffectiveTag` rather than re-implementing the predicate.
- Runtime progress and session policy must be loaded from `SystemSetting(id = "singleton")`. Authentication stamps a database-time policy expiry at login; progress submission evaluates the persisted Shanghai-time window.
- Managed avatars are UUID-named files under `public/uploads/avatars`; accept only validated 512×512 8-bit PNG output, write by temp-file rename, reject symlinks/path traversal, and never delete `/avatar/default.png`.
- Historical actor links use snapshots plus nullable foreign keys. Populate the bounded snapshot whenever the live relation is written; account deletion refreshes the deleted actor snapshot before clearing/reassigning responsibilities, revoking owned state, deleting credentials, and cleaning managed avatar files. A late audit for a deleted actor must recover the terminal snapshot from the account-deletion audit instead of creating an anonymous history row.
- Actor-authored writes and account lifecycle/status changes must share `lockUserLifecycle`; acquire multiple user locks with `orderUserLifecycleLockIds`, then recompute status and permissions inside the same transaction. Lock order is lifecycle-set (shared, or exclusive for bulk session invalidation) → advisor-relation when changing `User.advisorId` → sorted users → entity rows. Never upgrade locks or reuse a pre-lock ACTIVE snapshot.

### Testing Requirements
- Pure helpers here are directly tested in `tests/` (permissions, session, security, rate-limits, progress-window, validators). Any change must keep those green and add cases for new branches. Run `npm run test` / `npm run verify`.

### Common Patterns
- Snapshot-first design: write the pure decision function over a plain input object, then a thin `async` Prisma loader that calls it. This keeps the security logic unit-testable without a database.

## Dependencies

### Internal
- `prisma.ts` underpins the async wrappers; `auth.ts` composes `permissions`, `security`, `audit`, and `validators/auth`.

### External
- `@prisma/client`, `next-auth` + `next-auth/jwt`, `bcryptjs`, `zod`.

<!-- MANUAL: -->
