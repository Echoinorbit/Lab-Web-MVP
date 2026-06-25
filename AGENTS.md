<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# lab-platform (实验室协作管理平台)

## Purpose
A lab collaboration management platform built as a runnable MVP base (not a static demo, not yet a production product). It provides a Next.js 15 App Router application with a Prisma/PostgreSQL data model, NextAuth credential login, DB-backed session revocation, a dynamic Tag-based permission engine, audit logging, and time-windowed progress reports. Some list pages still render sample data and several CRUD/approval flows remain UI skeletons — see `README.md` for the exact completion status.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | Dependencies and scripts. Key scripts: `dev`, `build`, `verify`, `seed`, `test`, `typecheck` |
| `README.md` | Authoritative project status, setup, default account, permission model, and FAQ (written in Chinese) |
| `next.config.ts` | Next.js configuration |
| `tsconfig.json` | TypeScript config; defines the `@/*` → `src/*` path alias used everywhere |
| `tailwind.config.ts` | Tailwind CSS theme configuration |
| `eslint.config.mjs` | Flat ESLint config (lint must pass with `--max-warnings=0`) |
| `postcss.config.js` | PostCSS pipeline for Tailwind |
| `ecosystem.config.js` | PM2 process configuration |
| `.env.example` | Template for required env vars (`DATABASE_URL`, `AUTH_SECRET`, `ADMIN_*`) |
| `next-env.d.ts` | Next.js generated type shims (do not edit) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | Application source: routes, features, shared libraries (see `src/AGENTS.md`) |
| `prisma/` | Database schema, migrations, seed script (see `prisma/AGENTS.md`) |
| `tests/` | Node test-runner suites for security-critical invariants (see `tests/AGENTS.md`) |
| `scripts/` | Operational/E2E scripts: `cleanup-tags.ts`, `e2e-fixtures.ts`, `e2e-browser.ts`, `e2e-smoke.ts` (run via the `cleanup:tags` / `e2e:*` npm scripts) |
| `public/` | Static assets and runtime upload storage (`uploads/avatars`, `uploads/attachments`) |

## For AI Agents

### Working In This Directory
- Use the `@/*` import alias (maps to `src/*`); avoid long relative paths.
- This is an `ADMIN` = governance, `MEMBER` = content-capability architecture. `ADMIN` deliberately **cannot** author content (posts, projects); capability comes from Tags layered onto `MEMBER`. Do not "fix" this by granting `ADMIN` creation rights — it is an intentional invariant.
- All authorization is server-side. `src/middleware.ts` is only a route prefilter; real status / `tokenVersion` / password-change gates run in server components and actions via `requireActiveUser()` and the permission helpers.
- Permissions are computed dynamically from role + effective (non-revoked, non-expired) Tags. Project-scoped permissions **must** be checked with the `projectId` variant — never let project Tags cross project boundaries.

### Testing Requirements
- Run the full gate before claiming completion: `npm run verify` (= `prisma generate` + `tsc --noEmit` + `eslint` + node tests + `prisma validate`).
- Add/extend tests in `tests/` for any change to auth, permissions, sessions, rate limits, progress windows, or validators.
- Production sanity: `npm run build`. Dependency audit: `npm audit --audit-level=moderate`.

### Common Patterns
- Feature-sliced architecture under `src/features/<feature>/` with `components/`, `actions/`, optional `lib/`/`hooks/`/`types.ts`, and a barrel `index.ts`.
- Server actions start with `"use server"`, then: `requireActiveUser()` → Zod parse → `assertPermissionWithAudit` (or project variant) → optional `checkRateLimit` → `prisma.$transaction` that writes the entity, fans out notifications, and records an `AuditLog` row.

## Dependencies

### External
- Next.js 15 (App Router) + React 19 — application framework
- Prisma 6 + `@prisma/client` — PostgreSQL ORM
- NextAuth 5 (beta) — credential auth with JWT sessions
- Zod — input validation
- `@tanstack/react-query` — client data fetching (e.g. notifications polling)
- `bcryptjs` — password hashing
- `exceljs` — progress report export
- Tailwind CSS, `clsx`, `tailwind-merge`, `lucide-react`, `react-markdown` + `remark-gfm` — UI

<!-- MANUAL: Custom project notes can be added below this line. -->
