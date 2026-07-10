# Full-stack remediation migration runbook

This runbook covers the database rollout introduced by
`20260710140000_fullstack_remediation`. Run every command from the repository root.
Never use `prisma migrate reset` against a shared or production database.

## Scope and compatibility

The migration is an expand/backfill/contract rollout. It keeps the legacy physical
`User.grade` data as `User.legacyGrade`, adds canonical study identity, actor
snapshots, project leadership/status projection, lifecycle scheduling, and the
singleton runtime settings row. Existing ambiguous identity evidence is retained as
`identityNeedsReview`; the migration never guesses from enrollment date or cohort text.

The application must deploy with this migration. Older application code still reading
the physical `grade` column is not compatible after the rename, so rollback after
migration deployment requires the reviewed reverse procedure below or a full restore.

## Pre-deploy backup and evidence

1. Stop mutating jobs and record the application commit and current migration status.
2. Create a PostgreSQL custom-format backup outside the repository:

   ```sh
   set -a
   source .env
   pg_dump --format=custom --file=/secure/path/lab_platform_pre_fullstack.dump "${DATABASE_URL%%\?*}"
   npx prisma migrate status
   ```

3. Verify the dump with `pg_restore --list /secure/path/lab_platform_pre_fullstack.dump`.
4. Record counts for `User`, `Project`, `ProjectNode`, and historical content rows.

## Isolated migration rehearsal

Use a disposable schema on the same PostgreSQL major version. The schema name must be
unique and must not be `public`:

```sh
DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DB?schema=remediation_rehearsal' npx prisma migrate deploy
DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DB?schema=remediation_rehearsal' npm run remediation:readiness
DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DB?schema=remediation_rehearsal' npx prisma migrate status
```

Drop only that named disposable schema after evidence is captured. The integration test
harness performs this cleanup in `finally`.

## Deploy and verify

```sh
npx prisma migrate deploy
npx prisma generate
npm run prisma:validate
npm run remediation:readiness
npm run verify
npm run build
```

The readiness JSON is read-only. `ready` must be `true`. Deliberately ambiguous
identities may remain in `unresolvedIdentities`, but the stable reason ledger must be
reviewed and assigned to an administrator for repair. The following arrays/counts must
be empty or zero: identity projection drift, conflicting effective identity Tags,
active projects without a leader, project-status drift, lifecycle drift, and missing
actor snapshots. Exactly one settings row with id `singleton` must exist.

After the application is live, run fixtures and the authenticated smoke/browser suites
against a non-production environment. Provision an external scheduler for the
authenticated graduation-purge POST endpoint described in the operations section of the
README; do not use an in-process timer.

## Rollback

### Before any hard account deletion

The safest rollback is a full restore of the pre-deploy backup into a fresh database,
then switch the application connection after validation:

```sh
createdb lab_platform_restore
pg_restore --clean --if-exists --no-owner --dbname=lab_platform_restore /secure/path/lab_platform_pre_fullstack.dump
```

Run the previous application version and its migration status checks against the restored
database before traffic is moved. Do not restore over the only live database.

A reviewed reverse migration is possible only before the new lifecycle writes are used.
It must first restore a physical `grade` column from `legacyGrade`, remove the new triggers,
indexes, constraints, foreign keys, and enums in dependency order, and re-establish the
old restrictive foreign keys. Generate and review that SQL against a copy; it is not an
automatic production command in this repository.

### After any hard account deletion

Only a pre-deploy backup can restore deleted credentials and authentication state.
Historical content remains intentionally preserved with bounded actor snapshots, but it
cannot reconstruct usernames, student IDs, password hashes, token state, or custom avatars.
Treat restore as a full incident-recovery operation and reconcile post-backup writes before
cutover.

## Contract follow-up

Do not drop `legacyGrade` in this rollout. A later contract migration may remove it only
after a production observation window has a clean readiness report, all ambiguous rows
are resolved, rollback evidence is retained, and the application no longer depends on the
legacy evidence.
