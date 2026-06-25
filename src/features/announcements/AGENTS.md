<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# announcements (feature)

## Purpose
Announcement authoring and targeted delivery. The `createAnnouncement` server action is the reference implementation of the platform's full server-action pattern: auth → validate → permission+audit → rate limit → transactional write with notification fan-out and audit logging.

## Key Files
| File | Description |
|------|-------------|
| `actions/create.ts` | `createAnnouncement`: resolves recipients by `targetType` (ALL/USERS/PROJECT/TAG), then in one transaction creates the announcement, `createMany` notifications, and an audit row |
| `components/announcement-form.tsx` | Create form |
| `components/target-selector.tsx` | Picks delivery target (all / users / project / tag) |
| `components/announcement-list.tsx` | List of announcements |
| `components/announcement-card.tsx` | Single announcement display |
| `types.ts` | `AnnouncementSummary` and related types |
| `index.ts` | Barrel export |

## For AI Agents

### Working In This Directory
- Targeting only ever resolves **ACTIVE** users; tag targeting respects effective (non-revoked, non-expired) `UserTag`s and project targeting respects non-deleted projects. Preserve these filters.
- Creating an announcement requires `ANNOUNCEMENT_CREATE` and is rate-limited (`advisor`: 20/day). The targeted-notify capability is a separate permission (`announcement.notify_targeted`).
- Keep the announcement write, notification fan-out, and audit entry inside the single `prisma.$transaction` so they stay atomic.
- README notes the page form is not yet fully wired to this action — when wiring UI, call the existing action rather than duplicating logic.

### Testing Requirements
- `npm run verify` (typecheck/lint + shared unit tests). Validate against `@/shared/lib/validators/announcements`.

## Dependencies

### Internal
- `@/shared/lib/session`, `@/shared/lib/authorization`, `@/shared/lib/permissions`, `@/shared/lib/rate-limits`, `@/shared/lib/prisma`, `@/shared/lib/validators/announcements`.

### External
- Prisma, Zod, React.

<!-- MANUAL: -->
