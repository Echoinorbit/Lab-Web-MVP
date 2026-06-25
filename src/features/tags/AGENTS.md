<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# tags (feature)

## Purpose
Display layer for the Tag permission system: badges and lists that surface a user's Tags and the permissions they confer. Tags are the mechanism by which `MEMBER`s gain capability (posting, commenting, advising, progress management) and by which project-scoped roles are expressed.

## Key Files
| File | Description |
|------|-------------|
| `components/tag-badge.tsx` | Renders a single Tag chip |
| `components/tag-list.tsx` | Lists a user's Tags |
| `components/tag-permissions.tsx` | Shows the permissions a Tag grants |
| `index.ts` | Barrel export |

## For AI Agents

### Working In This Directory
- These are presentational components driven by data resolved server-side. The authoritative permission/Tag computation lives in `@/shared/lib/permissions` (`getEffectiveTags`, `getEffectiveTagNames`) — render from that, don't re-derive effectiveness here.
- Global Tags (e.g. `grad-master`, `grad-phd`, `advisor`, `progress-mgr`, `graduated`) have no `projectId`; project Tags (`project-lead`, `project-member`) carry a `projectId`. Distinguish them in display.
- Tag request/approve/revoke flows (`tag.request`/`tag.approve`/`tag.revoke`) are still UI skeletons per the README; build their actions following the standard server-action pattern.

### Testing Requirements
- Effective-tag logic is covered in `tests/permissions.test.ts`. Run `npm run verify`.

## Dependencies

### Internal
- `@/shared/lib/permissions`, `@/shared/components/ui/badge`.

### External
- React, Tailwind.

<!-- MANUAL: -->
