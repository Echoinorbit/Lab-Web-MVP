<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# features

## Purpose
Domain logic organized as self-contained feature slices. Each slice owns its UI (`components/`), its server-side mutations (`actions/`), and optionally feature `lib/`, `hooks/`, and `types.ts`, exposed through a barrel `index.ts`. Pages in `app/` import from these barrels.

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `auth/` | Login and forced password-change flows (see `auth/AGENTS.md`) |
| `posts/` | Posts and comments UI (see `posts/AGENTS.md`) |
| `progress/` | Monthly progress reports: forms, summary, export, windows (see `progress/AGENTS.md`) |
| `projects/` | Projects, members, timeline nodes (see `projects/AGENTS.md`) |
| `announcements/` | Announcement creation + targeted notification fan-out (see `announcements/AGENTS.md`) |
| `tags/` | Tag display and permission badges (see `tags/AGENTS.md`) |
| `notifications/` | Notification badge/list + 30s polling hook (see `notifications/AGENTS.md`) |
| `admin/` | Admin console widgets: users, audit, settings, Excel import (see `admin/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- A feature may depend on `@/shared/*` and on its own files; it should not import from another feature's internals (cross-feature reuse belongs in `shared/`). Import siblings only via their `index.ts` if truly necessary.
- Export the public surface from `index.ts`; pages and other modules import from `@/features/<feature>`, never deep paths.
- All `actions/` files are server actions (`"use server"`) and are the real authorization boundary — see the server-action pattern below.

### Common Patterns
Standard server-action shape (see `announcements/actions/create.ts` for the reference implementation):
1. `const user = await requireActiveUser()`
2. `const data = schema.parse(input)` (Zod from `@/shared/lib/validators`)
3. `await assertPermissionWithAudit({ ... })` — or `assertProjectPermissionWithAudit` with `projectId`
4. optional `await checkRateLimit(user.id, action)`
5. `prisma.$transaction(...)` that writes the entity, creates `Notification` rows for recipients, and appends an `AuditLog` entry.

### Testing Requirements
- Feature logic is exercised through the shared helpers' unit tests plus `tsc`/`lint`. Run `npm run verify`.

## Dependencies

### Internal
- `@/shared/lib/*` (session, authorization, permissions, rate-limits, prisma, validators), `@/shared/components/*`.

### External
- React 19, Prisma, Zod; `exceljs` (progress export), React Query (notifications).

<!-- MANUAL: -->
