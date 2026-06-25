<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# app

## Purpose
The Next.js App Router tree: the root layout/providers, two route groups (`(auth)` for unauthenticated flows, `(dashboard)` for the authenticated app shell), and `api/` route handlers. Pages are async server components that enforce access via `requireActiveUser()` and the permission helpers, then compose feature components.

## Key Files
| File | Description |
|------|-------------|
| `layout.tsx` | Root HTML layout; wraps the app in `providers.tsx` |
| `providers.tsx` | Client providers (React Query, theme/session as needed) |
| `globals.css` | Global Tailwind styles and CSS variables |
| `page.tsx` (root) | Landing/redirect entry |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `(auth)/` | Public auth pages: `login/`, `change-password/` (route group, no URL segment) |
| `(dashboard)/` | Authenticated shell with `layout.tsx` and feature pages: `posts/`, `projects/`, `progress/`, `announcements/`, `notifications/`, `profile/`, `admin/` (with `users/`, `tags/`, `audit/`, `settings/`). Dynamic routes use `[id]` |
| `api/` | Route handlers: `auth/[...nextauth]` (NextAuth), `auth/change-password`, `notifications` (30s client poll target) |

## For AI Agents

### Working In This Directory
- Every authenticated page must call `requireActiveUser()` (which redirects to `/login` or `/change-password`) before rendering. Admin/governance pages additionally assert the relevant permission.
- `(auth)` and `(dashboard)` are route groups — the parenthesized name does **not** appear in the URL. `/login` and `/change-password` are the only routes the middleware treats as public (plus `/api/auth`).
- Keep pages thin: fetch data + check access here, render imported feature components. Put mutations in `features/<feature>/actions/`, not inline in pages.
- API route handlers must re-authenticate server-side; do not rely on the middleware for authorization.

### Testing Requirements
- Routing/permission changes are validated indirectly via `tsc`/`lint` and the security unit tests; verify protected pages still redirect when unauthenticated.

### Common Patterns
- Server components by default; add `"use client"` only for interactive leaf components (most live under `features/*/components`).
- Dynamic segments (`[id]`) receive `params` and load the entity, filtering soft-deleted rows (`deletedAt: null`).

## Dependencies

### Internal
- `@/features/*` (page composition), `@/shared/lib/session` + `@/shared/lib/authorization` (gates), `@/shared/components/layout` (shell).

### External
- Next.js App Router, NextAuth route handlers, React Query (client polling).

<!-- MANUAL: -->
