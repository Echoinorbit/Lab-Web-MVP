<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# prisma

## Purpose
Database layer for the platform: the Prisma schema (PostgreSQL), generated migrations, and the seed script that bootstraps the single admin account plus system Tag templates.

## Key Files
| File | Description |
|------|-------------|
| `schema.prisma` | Single source of truth for the data model and enums |
| `seed.ts` | Seeds the admin user (from `ADMIN_*` env) with `mustChangePassword=true`, and system Tag templates. Fails intentionally if `DATABASE_URL`/`ADMIN_PASSWORD` are missing. Run via `npm run seed` |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `migrations/` | Generated SQL migrations; `20260622140500_initial/migration.sql` is the initial schema |

## Data Model Notes
- **Auth/session control on `User`**: `passwordHash`, `mustChangePassword`, `tokenVersion` (incrementing this revokes all existing sessions), `loginAttempts`, `lockedUntil`, `status`.
- **Permission engine**: `Tag` (GLOBAL or PROJECT `scope`, optional `permissions` JSON or `TagTemplate`), `UserTag` (grant with optional `projectId`, `expiresAt`, `revokedAt`). Effective = not revoked and not expired.
- **Rate limiting / abuse**: `RateLimitCounter`, `IpLoginFailureCounter`, `ProgressBackfillWindow` (one open window per user/year/month, has `expiresAt` and `usedAt`).
- **Soft deletes**: most content models (`Announcement`, `Post`, `Comment`, `Project`, `ProjectNode`, `ProgressReport`) use a nullable `deletedAt`; queries must filter `deletedAt: null`.
- **Audit**: `AuditLog` with a wide `AuditAction` enum — every privileged mutation should append a row.

## For AI Agents

### Working In This Directory
- Editing `schema.prisma` requires a migration (`npx prisma migrate dev`) and `prisma generate`. Never hand-edit applied migration SQL.
- Preserve `onDelete` semantics: content authors use `Restrict` (block deletion of referenced users); `Cascade` is reserved for ownership-style links (e.g. `Notification`→`User`, `UserTag`→`Tag`/`Project`).
- Keep the `@@index`/`@@unique` constraints — the upsert-based counters rely on the composite unique keys.

### Testing Requirements
- `npm run prisma:validate` validates the schema; it is part of `npm run verify`.
- After schema changes, regenerate the client so `tsc --noEmit` reflects new types.

## Dependencies

### Internal
- Consumed everywhere through the singleton `src/shared/lib/prisma.ts`.

### External
- `prisma` / `@prisma/client` 6.x, PostgreSQL 16, `tsx` (runs `seed.ts`), `bcryptjs` (hashing in seed).

<!-- MANUAL: -->
