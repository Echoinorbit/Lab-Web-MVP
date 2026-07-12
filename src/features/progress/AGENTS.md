<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# progress (feature)

## Purpose
Monthly progress reports with a persisted, timezone-aware write window and a controlled backfill mechanism. Members write/submit reports only during the `SystemSetting` window for the current `Asia/Shanghai` period; outside that, an admin/progress-manager must open a time-limited backfill window. Progress managers can read all reports and export to Excel.

## Key Files
| File | Description |
|------|-------------|
| `lib/backfill.ts` | Lifecycle-locked backfill opening, `resolveProgressWriteWindow`, and transactional `consumeBackfillWindow` |
| `actions/save-report.ts` | Saves a DRAFT report (gated by the write window) |
| `actions/submit-report.ts` | Submits a report; consumes any backfill window |
| `actions/open-backfill-window.ts` | Opens a 24h backfill window for a user/month (requires `progress.backfill`); audits `PROGRESS_BACKFILL` |
| `actions/export-excel.ts` | Exports report summary via `exceljs` (requires `progress.export`); audits `EXPORT` |
| `components/report-form.tsx` | Report authoring form |
| `components/report-list.tsx` | User's report history |
| `components/summary-table.tsx` | Aggregated view for managers |
| `components/export-button.tsx` | Triggers export |
| `index.ts` | Barrel export |

## For AI Agents

### Working In This Directory
- Window rules live in `@/shared/lib/date`, while the configured start/end day and minute come from `SystemSetting(id = "singleton")`. Do not re-derive dates locally or fall back to hardcoded days. Backfill windows last `PROGRESS_BACKFILL_WINDOW_HOURS` (24h) and are single-use (`usedAt`).
- A backfill window is `expiresAt > now` AND `usedAt == null`; submitting must mark it used so it can't be reused. There is at most one window per `(userId, year, month)` (DB unique).
- Permission split: writing/submitting needs `progress.report.write`/`progress.report.submit`; reading everyone's reports needs `progress.report.read_all`; export needs `progress.export`; opening backfill needs `progress.backfill`.
- Opening a backfill window must lock manager and target in stable order, then re-read manager permission and target ACTIVE state inside the same transaction; deletion must win over a stale request without leaving a window.

### Testing Requirements
- Unit tests cover date/window boundaries and persisted-setting form validation. Database-backed setting conflicts and real submit enable/disable behavior also require the disposable integration suite and browser E2E. Run `npm run verify`.

## Dependencies

### Internal
- `@/shared/lib/date`, `@/shared/lib/prisma`, `@/shared/lib/session`, `@/shared/lib/authorization`, `@/shared/lib/validators/progress`.

### External
- `exceljs` (export), Prisma, Zod.

<!-- MANUAL: -->
