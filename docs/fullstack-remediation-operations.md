# Full-stack remediation operations runbook

This document covers the operational controls added by the full-stack remediation. It complements the [database migration runbook](fullstack-remediation-migration.md). Run destructive or data-changing commands only in the intended environment and keep database and upload backups from the same recovery point.

## Deployment order

1. Record the application commit and run `npx prisma migrate status`.
2. Back up PostgreSQL with `pg_dump --format=custom` and back up `public/uploads/avatars`.
3. Rehearse migrations and the integration suite against a unique disposable PostgreSQL schema.
4. Deploy with `npx prisma migrate deploy`, then run `npx prisma generate`.
5. Require `npm run remediation:readiness` to return `"ready": true`.
6. Run `npm run verify`, the disposable-schema integration suite, `npm run build`, and non-production E2E tests.
7. Deploy the application and configure the two authenticated cron routes below.

Never use `prisma migrate reset` or a test schema name that resolves to `public` in a shared environment.

The automated PostgreSQL rehearsal is:

```bash
npm run test:integration
```

It derives two unique schemas from `.env` `DATABASE_URL`: `remediation_upgrade_*` stages adversarial legacy data before applying the remediation migration, then `remediation_it_*` verifies a clean install, seed, settings, lifecycle/snapshot, project-trigger, and concurrency behavior. Both schemas are dropped in `finally`. The database role therefore needs schema create/drop privileges. The runner never targets the source URL's existing application schema.

## Runtime settings

`/admin/settings` edits the singleton `SystemSetting` row (`id = "singleton"`). The row owns:

- monthly progress-window start/end day and minute, interpreted in `Asia/Shanghai`;
- login policy duration in whole hours, from 1 through 720;
- optimistic revision and updater snapshot used for conflict detection/audit.

Progress submission reads this row on the server for every decision. Successful login reads `sessionHours` using database time and stamps a policy expiry into the JWT-backed session. Changing `sessionHours` also increments every user's `tokenVersion` in the same transaction, so all existing sessions are invalid immediately and every user must sign in again under the new duration.

Bulk invalidation takes the lifecycle-set exclusive lock before any user row; ordinary user mutations take its shared form. Advisor relation changes add a single relation lock before sorted per-user locks. Keep this order when adding mutations: lifecycle set → advisor relation (when applicable) → sorted users → entity rows.

The migration creates/backfills the singleton row. A missing row is a deployment error, not a reason to fall back to environment constants.

## Graduated-account purge scheduler

Set a high-entropy `CRON_SECRET` in the application and scheduler. The endpoint accepts only an exact bearer secret:

```bash
curl -sS --fail-with-body \
  -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://lab.example/api/cron/purge-graduated-users
```

Recommended schedule: hourly, offset from other maintenance jobs. Each invocation selects at most 50 users whose database-time `scheduledDeletionAt` is due. Eligibility is rechecked under a row lock inside the same deletion service used by manual permanent deletion, making retries and concurrent invocations idempotent.

Response fields:

- `processed`: candidates examined;
- `deleted`: accounts removed;
- `skipped`: rows already absent or no longer eligible;
- `failed`: per-account transaction failures;
- `avatarCleanupFailed`: managed-avatar deletion or orphan-sweep failures;
- `orphanedAvatarsRemoved`: stale managed avatar files deleted after the batch.

HTTP `200` means the batch had no account or avatar-cleanup failures. HTTP `207` means at least one candidate or avatar cleanup failed; alert on it and retry after investigating application/database and avatar-volume health. HTTP `401` means scheduler secret/configuration failure. Do not implement an in-process `setInterval`; Next.js instances are not reliable job schedulers.

Graduation behavior is intentionally narrow:

- only graduated master/doctor members without identity-review ambiguity receive the three-day schedule;
- graduation revokes all active Tags and sessions;
- cancellation clears the schedule and restores only the canonical `STUDY_IDENTITY` degree Tag;
- deletion snapshots historical attribution, clears or flags active responsibilities, deletes credentials, then removes the managed avatar.

## Audit export scheduler

The existing audit-export route uses the same bearer secret:

```bash
curl -sS --fail-with-body \
  -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://lab.example/api/cron/audit-export
```

Schedule it independently (for example weekly). Store generated exports according to the deployment's retention and access-control policy.

Each run creates the `AuditExportArchive` before advancing the counter. The fourth run in a cycle clears only source `AuditLog` rows older than that archive's range end; the workbook already contains lifecycle-aware actor name/state columns, so deleted or graduated attribution remains readable after cleanup.

## Avatar storage

The default asset is immutable application content at `public/avatar/default.png`. Managed user files live under `public/uploads/avatars` and are UUID-named PNG files. The server accepts only a fully decoded 512 × 512, 8-bit, non-interlaced RGB/RGBA PNG smaller than 2 MiB, writes it through an exclusive temporary file plus atomic rename, and stores only the managed public path in PostgreSQL.

Operational requirements:

- persist `public/uploads/avatars` across releases or replace it with an equivalent reviewed durable-storage adapter before horizontal/ephemeral deployment;
- back up the directory together with the database so paths and files share a recovery point;
- do not serve it with script execution enabled;
- do not permit symlinks in the directory;
- never delete or overwrite `public/avatar/default.png` as part of orphan cleanup;
- allow the purge/update path to remove managed files only after the corresponding database transaction succeeds.

Orphan cleanup has a 15-minute grace period to avoid racing an in-flight atomic write. A database restore without the matching avatar backup may legitimately fall back to the default image; it cannot reconstruct deleted custom avatar bytes.

Avatar replacement and manual permanent deletion report cleanup failure explicitly instead of claiming an unconditional success. The database change remains committed, while the scheduled graduated-account purge performs the same orphan sweep on later runs; alert if the warning persists and verify avatar-volume permissions and availability.

## Member import operations

Download the live template from `/api/admin/users/import-template` through an authenticated administrator session. Required column order is:

```text
username, displayName, password, studentId, studyDegree, studyGrade
```

Limits are 5 MiB and 500 nonblank data rows. Preview tokens are bound to the administrator, SHA-256 workbook digest, parser version, and a five-minute expiry. Confirmation reparses the exact file and performs conflict checks and account/identity/Tag creation atomically. Do not build an alternate spreadsheet format or bypass preview in an operational script.

## Permanent deletion and recovery

Manual deletion requires the administrator to type the exact username. The service blocks self-deletion and deletion of the last active administrator. Before credentials are removed it writes bounded identity snapshots to posts, comments, announcements, project records, memberships/nodes, progress reports, notifications, Tag grant/revoke records, system settings, and audit logs. Active project leadership becomes an explicit reassignment task.

Historical snapshots preserve display attribution, not credentials. After deletion, only a pre-delete database backup can recover username, student ID, password hash, token state, or the account itself. Restore into a separate database, validate migrations/readiness, reconcile newer writes, and cut over deliberately; never restore over the only live database.

## Monitoring checklist

- Alert on cron `401`, `207`, timeout, or missing invocation.
- Track `remediation:readiness` drift, especially unresolved identity, missing snapshots, project leader/status drift, lifecycle drift, and singleton settings count.
- Monitor free space and backup age for PostgreSQL and the avatar volume.
- Record deletion and settings audit events; investigate unexpected actor snapshots or repeated optimistic-revision conflicts.
- Re-run the disposable-schema migration/integration suite before every schema-affecting release.
