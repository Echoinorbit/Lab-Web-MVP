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
- Server actions start with `"use server"`, then: `requireActiveUser()` → Zod parse → `assertPermissionWithAudit` (or project variant) → `prisma.$transaction` with optional `enforceRateLimit(tx, ...)`, the entity write, notification fan-out, and an `AuditLog` row.

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

## Frontend Rebuild Rules

- Frontend redesigns are system changes, not isolated style patches. Start with a complete route/page inventory and identify the shared shell, page templates, states, and primitives before editing screens.
- For an explicitly requested whole-site rebuild, replacing obsolete presentation-layer markup and components is allowed. Preserve server actions, Prisma query semantics, authorization gates, URL contracts, and business-state meanings.
- Do not claim a whole-site redesign after changing only the home page, navigation, colors, radii, shadows, tokens, or a small subset of routes.
- `awesome-design-md` is the primary visual reference skill for design-led work in this repository. For the Apple-inspired system, apply its hierarchy, whitespace, restrained color, typography, and interaction principles without copying Apple assets, content, or trade dress.
- All primary authenticated and unauthenticated pages must use the shared design system and page templates. Data-heavy tools may remain dense; marketing-style hero layouts must not be forced onto operational screens.
- Every data or form surface must account for the applicable loading, empty, error, success, pending, disabled, and permission-denied states. Do not design only the populated happy path.
- Verify 390px, 768px, 1024px, and 1440px layouts. Tables need an explicit small-screen overflow or reflow strategy; forms must remain completable on mobile.
- Preserve semantic HTML, visible keyboard focus, labels, accessible names for icon buttons, minimum practical touch targets, and `prefers-reduced-motion` behavior.
- Perform real-browser visual QA for major routes in at least two passes: first for information architecture and responsive structure, then for typography, spacing, interaction states, and visual residue.
- Before completion, run `npm run verify` and `npm run build`. Do not weaken lint, types, tests, or security controls to manufacture a passing result.
- Do not discard user changes. Keep frontend rebuilds on a dedicated branch, review every staged diff, and use meaningful phase commits.
- Record major design and frontend architecture decisions in repository documentation. Runtime screenshots, temporary probes, and one-off progress logs do not belong in `AGENTS.md`.
