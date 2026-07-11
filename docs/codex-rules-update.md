# Codex Rules Update

## Updated tracked guidance

| File | Durable remediation contract |
| --- | --- |
| `AGENTS.md` | Canonical project-state projection, study-identity/Tag separation, write-time actor snapshots, graduated-account scheduling, server-side authorization, shared feedback/dialogs, persisted settings, cache refresh/locking, destructive-flow coverage, and migration rehearsal |
| `prisma/AGENTS.md` | Nullable snapshot-backed history relations, leader/status projections, singleton settings, formal migration and disposable-schema requirements |
| `src/features/admin/AGENTS.md` | Standalone user editor, atomic identity projection, graduation/permanent deletion, persisted settings, and six-column signed import preview |
| `src/features/announcements/AGENTS.md` | Server-side author ownership for edits and structured feedback behavior |
| `src/features/progress/AGENTS.md` | Database-configured Shanghai progress window; no hardcoded day fallback |
| `src/features/projects/AGENTS.md` | Canonical leader, node-derived status priority, reassignment, archive permission, and concurrency tests |
| `src/shared/components/AGENTS.md` | Shared accessible Dialog/Toast/avatar contracts and prohibition of native alert/confirm feedback |
| `src/shared/lib/AGENTS.md` | Settings, study identity, project state, snapshot, avatar, session, and write-time historical attribution boundaries |
| `tests/AGENTS.md` | Clear split between DB-free tests, disposable PostgreSQL integration, and real-browser destructive-flow coverage |

## Long-term constraints added

- `ADMIN` remains governance-only; content capability comes from effective Tags on `MEMBER` accounts.
- Role, degree, grade, canonical system Tags, and custom capability Tags remain separate concepts.
- Active actor relations and audit writes carry bounded snapshots from creation; deletion refreshes attribution before nullable foreign keys are cleared.
- Project `PLANNING`/`IN_PROGRESS` state follows non-deleted nodes, with `ARCHIVED`/`COMPLETED` taking priority; `leaderId` is the sole leader source.
- Progress-window and login-duration settings are real singleton database policy, not UI/environment decoration.
- Graduated-student cleanup is database-time, externally scheduled, idempotent, and routed through the same deletion service as manual deletion.
- Destructive actions use the accessible shared dialog and require allow/deny, duplicate-submit, integration, and browser evidence appropriate to the risk.
- Schema delivery requires formal migrations, backup/rollback documentation, readiness reporting, and an isolated-schema rehearsal; `db push` is not a release path.

## OMX/Codex scope decision

- Tracked `AGENTS.md` files are the repository's durable Codex/OMX control surface.
- `.omx/` plans, state, screenshots, and reports are runtime evidence and remain untracked session artifacts.
- No tracked project `.codex` configuration with a stable schema exists, so no unknown-schema workflow file was invented or modified.
- User-level Codex/OMX configuration was not changed; therefore there is no cross-project impact or user-config backup to restore.

## Validation and rollback

- Guidance changes are reviewed in the same phase commit as the matching operations/migration documentation.
- Runtime behavior remains enforced by unit/static tests, the disposable PostgreSQL suite, readiness, smoke/browser E2E, `npm run verify`, and `npm run build`.
- Roll back with a normal Git revert of the documentation commit. No generated runtime state or user-level configuration needs restoration.
