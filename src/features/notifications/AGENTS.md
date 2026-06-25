<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# notifications (feature)

## Purpose
In-app notifications: an unread badge, a notification list, and a client hook that polls the API every 30 seconds. Notifications are produced as a side effect of other features' transactions (announcements, comments, project nodes, tag grants).

## Key Files
| File | Description |
|------|-------------|
| `hooks/use-notifications.ts` | React Query hook polling `/api/notifications` on a 30s interval |
| `components/notification-badge.tsx` | Unread-count indicator |
| `components/notification-list.tsx` | Notification feed |
| `index.ts` | Barrel export |

## For AI Agents

### Working In This Directory
- The polling target is the route handler at `src/app/api/notifications/route.ts`, which currently returns an empty array (per README). Wiring real data means querying `Notification` for the active user (using the `@@index([userId, isRead])` index) — keep the 30s `use-notifications` contract stable.
- Notifications are created by **other** features inside their `prisma.$transaction` (e.g. `announcements/actions/create.ts` does `tx.notification.createMany`). Add new notification types to the `NotificationType` enum in `schema.prisma` and emit them from the originating action, not here.
- Read-state: mark-as-read should set `isRead`/`readAt`; this flow is not yet implemented.

### Testing Requirements
- `npm run verify`. No dedicated suite yet; add one if you introduce non-trivial query/read-state logic.

## Dependencies

### Internal
- `src/app/api/notifications/route.ts`, `@/shared/lib/prisma` (when wired), `@/shared/lib/session`.

### External
- `@tanstack/react-query` (polling), React.

<!-- MANUAL: -->
