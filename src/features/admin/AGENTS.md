<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# admin (feature)

## Purpose
Governance console widgets used by the `/admin/*` pages: user management, audit-log viewing, system settings, and bulk user import from Excel. `ADMIN` is the governance role — it manages users, Tags, settings, audit, and content moderation, but never authors content.

## Key Files
| File | Description |
|------|-------------|
| `components/user-table.tsx` | User listing/management |
| `components/user-create-form.tsx` | Create a single user |
| `components/excel-import.tsx` | Bulk user import via Excel upload |
| `components/import-result.tsx` | Renders import outcome (successes/errors) |
| `components/audit-log-table.tsx` | Audit log viewer (`admin.audit.view`) |
| `components/settings-form.tsx` | System settings (`admin.settings`) |
| `index.ts` | Barrel export |

## For AI Agents

### Working In This Directory
- All admin operations require the corresponding governance permission: `admin.user.manage`, `admin.tag.manage`, `admin.audit.view`, `admin.settings`, `admin.dashboard` — assert these in the page/action, not just by hiding UI.
- Maintain the governance/authoring separation: do **not** grant `ADMIN` content-creation abilities. To create content, an admin provisions a `MEMBER` and grants Tags (e.g. `advisor`).
- Privileged mutations (create/import users, role/status/advisor changes) must write the matching `AuditLog` action (`IMPORT`, `ROLE_CHANGE`, `STATUS_CHANGE`, `ADVISOR_CHANGE`, etc.). New users follow the seeded-admin pattern: `mustChangePassword=true`.
- Per the README, much of this is still skeleton/sample-data; the server-side permission protection on the pages is real — keep it.

### Testing Requirements
- `npm run verify`. Audit/permission helpers are covered in `tests/permissions.test.ts`.

## Dependencies

### Internal
- `@/shared/lib/authorization`, `@/shared/lib/permissions`, `@/shared/lib/audit`, `@/shared/lib/prisma`, `@/shared/components/data-table` + `file-upload`.

### External
- `exceljs` (import parsing), Prisma, React.

<!-- MANUAL: -->
