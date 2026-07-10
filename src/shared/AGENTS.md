<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# shared

## Purpose
Cross-cutting code used by every feature and route: the security/persistence libraries (`lib/`), primitive and layout UI (`components/`), reusable React hooks (`hooks/`), and shared TypeScript types (`types/`). This layer is the foundation — it must not import from `features/` or `app/`.

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `lib/` | Auth, permissions, sessions, audit, rate limits, dates, security, Prisma client, validators (see `lib/AGENTS.md`) |
| `components/` | Primitive UI (`ui/`), layout shell (`layout/`), and composite widgets (see `components/AGENTS.md`) |
| `types/` | Shared cross-feature type definitions |

## For AI Agents

### Working In This Directory
- This layer is dependency-free of higher layers. If you find yourself needing a feature type here, the type belongs in `shared/types` or the dependency is inverted.
- `lib/` is the security core — changes here ripple across the whole app and are covered by `tests/`. Prefer adding pure, snapshot-based helpers (testable without a DB) alongside the `async` Prisma wrappers, mirroring the existing `*FromSnapshot` pattern.

### Common Patterns
- Pure logic + thin async wrapper: e.g. `computePermissionsFromSnapshot` (pure, tested) vs `getUserPermissions` (queries Prisma then calls the pure fn).

## Dependencies

### Internal
- Self-contained; only `lib/` modules depend on each other.

### External
- Prisma, NextAuth, Zod, bcryptjs, React, Tailwind utilities (`clsx`, `tailwind-merge`).

<!-- MANUAL: -->
