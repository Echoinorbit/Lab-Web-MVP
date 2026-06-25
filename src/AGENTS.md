<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# src

## Purpose
All application source. Organized into three layers: route/UI composition (`app/`), feature slices (`features/`), and cross-cutting shared code (`shared/`). Routing and rendering live in `app/`; domain logic and feature UI live in `features/`; the security, persistence, and primitive UI building blocks live in `shared/`.

## Key Files
| File | Description |
|------|-------------|
| `middleware.ts` | Edge route prefilter — redirects unauthenticated requests to `/login`. **Not** the security boundary; real gates (status, `tokenVersion`, password-change) run server-side |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router: layouts, route groups, pages, API routes (see `app/AGENTS.md`) |
| `features/` | Self-contained domain slices (auth, posts, progress, …) (see `features/AGENTS.md`) |
| `shared/` | Cross-cutting libs, primitive UI, hooks, validators (see `shared/AGENTS.md`) |
| `types/` | Ambient type declarations; `next-auth.d.ts` augments the session/JWT with `role`, `status`, `permissions`, `tags`, `tokenVersion` |

## For AI Agents

### Working In This Directory
- Import direction flows one way: `app/` → `features/` → `shared/`. Features may use `shared/`; `shared/` must not import from `features/` or `app/`.
- Consume features through their barrel `index.ts` (e.g. `import { AnnouncementForm } from "@/features/announcements"`), not deep paths.
- Server components and server actions are the trust boundary. Always re-derive the active user with `requireActiveUser()` server-side; never trust client-passed identity or the middleware result.

### Testing Requirements
- `npm run verify` from the repo root covers this whole tree (typecheck + lint + tests).

### Common Patterns
- Server-first: pages are async server components that fetch via Prisma; mutations are `"use server"` actions in `features/<feature>/actions/`.
- `@/*` alias resolves to this directory.

## Dependencies

### External
- Next.js 15, React 19, NextAuth 5, Prisma, Zod, Tailwind.

<!-- MANUAL: -->
