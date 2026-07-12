<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# admin (feature)

## Purpose
Governance console widgets used by the `/admin/*` pages: user management, audit-log viewing, system settings, and bulk user import from Excel. `ADMIN` is the governance role — it manages users, Tags, settings, audit, and content moderation, but never authors content.

## Key Files
| File | Description |
|------|-------------|
| `components/user-table.tsx` | Paginated user listing and links to standalone editors |
| `components/user-editor.tsx` | Standalone user governance editor, lifecycle controls, and permanent deletion |
| `components/user-create-form.tsx` | Create a single user |
| `components/excel-import.tsx` | Bulk user import via Excel upload |
| `components/audit-log-table.tsx` | Audit log viewer (`admin.audit.view`) |
| `components/settings-form.tsx` | Persisted progress-window/session settings (`admin.settings`) |
| `index.ts` | Barrel export |

## For AI Agents

### Working In This Directory
- All admin operations require the corresponding governance permission: `admin.user.manage`, `admin.tag.manage`, `admin.audit.view`, `admin.settings`, `admin.dashboard` — assert these in the page/action, not just by hiding UI.
- Maintain the governance/authoring separation: do **not** grant `ADMIN` content-creation abilities. To create content, an admin provisions a `MEMBER` and grants Tags (e.g. `advisor`).
- Privileged mutations (create/import users, role/status/advisor changes) must write the matching `AuditLog` action (`IMPORT`, `ROLE_CHANGE`, `STATUS_CHANGE`, `ADVISOR_CHANGE`, etc.). New users follow the seeded-admin pattern: `mustChangePassword=true`.
- Create/edit/import must call the shared study-identity service so role, degree, grade, and canonical system Tags change atomically under stable actor/target locks. Mentors have no grade; master/doctor grades use their own bounded enums.
- Graduation revokes active Tags and schedules eligible students for deletion after three days. Cancellation restores only the canonical study Tag. Manual permanent deletion requires the exact username, cannot delete self/last active admin, and preserves historical snapshots.
- Status, graduation, identity, session-revocation, and deletion mutations share the stable per-user lifecycle lock with content writes. Advisor assignment/removal takes the advisor-relation lock before resolving old/new participants; then lock actor, target, old advisor, new advisor, and deletion advisees in sorted order before re-reading state.
- Settings are optimistic-concurrency controlled and stored in `SystemSetting(id = "singleton")`; form defaults must come from the database, not constants. A `sessionHours` change takes the lifecycle-set exclusive lock before any user row and increments every `tokenVersion` atomically.
- Import uses the downloadable six-column template, signed five-minute preview, 5 MiB/500-row limits, strict password/degree-grade validation, and atomic creation. Formula/hyperlink identity cells are rejected.

### Testing Requirements
- Run `npm run verify`, the disposable PostgreSQL integration suite, and the admin browser flows after lifecycle/import/settings changes.

## Dependencies

### Internal
- `@/shared/lib/authorization`, `@/shared/lib/permissions`, `@/shared/lib/audit`, `@/shared/lib/prisma`, `@/shared/components/data-table` + `file-upload`.

### External
- `exceljs` (import parsing), Prisma, React.

<!-- MANUAL: -->
