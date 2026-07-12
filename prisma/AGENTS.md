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
- **Canonical study identity on `User`**: `studyDegree`, `studyGrade`, `identityNeedsReview`, and retained `legacyGrade`. Degree/grade combinations follow the root invariants; canonical global Tags are projections with `UserTag.source = STUDY_IDENTITY`.
- **Lifecycle on `User`**: `graduatedAt` and `scheduledDeletionAt` are database-time facts. Only graduated master/doctor members are eligible for the three-day scheduled purge.
- **Permission engine**: `Tag` (GLOBAL or PROJECT `scope`, optional `permissions` JSON or `TagTemplate`), `UserTag` (grant with optional `projectId`, `expiresAt`, `revokedAt`). Effective = not revoked and not expired.
- **Rate limiting / abuse**: `RateLimitCounter`, `IpLoginFailureCounter`, `ProgressBackfillWindow` (one open window per user/year/month, has `expiresAt` and `usedAt`).
- **Soft deletes**: most content models (`Announcement`, `Post`, `Comment`, `Project`, `ProjectNode`, `ProgressReport`) use a nullable `deletedAt`; queries must filter `deletedAt: null`.
- **History retention**: actor/content foreign keys are nullable `onDelete: SetNull`; the corresponding JSON snapshot must be written before account deletion so names, study identity, status, and avatar fallback remain attributable.
- **Projects**: `leaderId` is the canonical leader projection; it requires an active resolved direct-student leader, an active resolved mentor advisor, exactly one effective `PROJECT_LEAD` Tag, and a matching `ProjectMember` row. Active projects without a leader set `leaderNeedsReassignment`; terminal/deleted projects do not. `PLANNING`/`IN_PROGRESS` is derived from non-deleted nodes, with `ARCHIVED`/`COMPLETED` taking priority.
- **Runtime settings**: `SystemSetting(id = "singleton")` stores progress-window and session-duration policy consumed by application logic.
- **Audit**: `AuditLog` with a wide `AuditAction` enum and `actorSnapshot` — every privileged mutation should append a row.

## For AI Agents

### Working In This Directory
- Editing `schema.prisma` requires a formal migration and `prisma generate`. Never hand-edit an already-applied migration; generate and review a new migration instead.
- Responsibility corrections after an applied migration must be forward-only. Preserve invalid legacy leader rows as revoked evidence and snapshots; never promote ambiguous, ineligible, cross-advisor, or invalid-advisor evidence into live authority.
- Preserve `onDelete` semantics: historical actor/author relations use `SetNull` plus snapshots; `Cascade` is reserved for ownership-only data that must disappear with an account. Do not change either category without a deletion-history integration test.
- Keep the `@@index`/`@@unique` constraints — the upsert-based counters rely on the composite unique keys.
- Rehearse both legacy-upgrade and clean-install paths against unique disposable PostgreSQL schemas. `npm run remediation:readiness` must report no unresolved identities, missing active leaders, invalid leader projections, status/lifecycle drift, or missing snapshots before deployment.

### Testing Requirements
- `npm run prisma:validate` validates the schema; it is part of `npm run verify`.
- After schema changes, regenerate the client so `tsc --noEmit` reflects new types.

## Dependencies

### Internal
- Consumed everywhere through the singleton `src/shared/lib/prisma.ts`.

### External
- `prisma` / `@prisma/client` 6.x, PostgreSQL 16, `tsx` (runs `seed.ts`), `bcryptjs` (hashing in seed).

<!-- MANUAL: -->
