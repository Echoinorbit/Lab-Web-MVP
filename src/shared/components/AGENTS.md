<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# components

## Purpose
Reusable, feature-agnostic UI: low-level primitives (`ui/`), the authenticated app shell (`layout/`), and a few composite widgets (data tables, file upload, markdown editor/renderer) shared across features.

## Key Files
| File | Description |
|------|-------------|
| `data-table.tsx` | Generic table for list views |
| `file-upload.tsx` | File input/upload widget (avatars, attachments) |
| `markdown-editor.tsx` | Markdown authoring control (posts, announcements) |
| `markdown-renderer.tsx` | Renders markdown via `react-markdown` + `remark-gfm` |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `ui/` | Primitives: `button`, `input`, `textarea`, `label`, `card`, `badge` |
| `layout/` | App shell: `header`, `sidebar`, `mobile-nav`, `theme-toggle` |

## For AI Agents

### Working In This Directory
- Keep these components domain-free — no Prisma, no permission logic, no feature imports. Pass data and callbacks in via props.
- Style with Tailwind; compose class names with the `cn` helper from `@/shared/lib/utils`.
- Mark interactive components `"use client"`; keep purely presentational ones server-compatible where possible.

### Common Patterns
- Prop interfaces declared above the component; primitives forward refs and spread native attributes.

## Dependencies

### Internal
- `@/shared/lib/utils` (`cn`).

### External
- React 19, Tailwind, `clsx` + `tailwind-merge`, `lucide-react`, `react-markdown` + `remark-gfm`.

<!-- MANUAL: -->

## Design System Rules

- Shared primitives are the only source for recurring control height, radius, focus ring, disabled state, typography, and transition timing. Reuse them instead of duplicating long Tailwind strings in pages.
- Keep the product palette restrained: neutral surfaces and one blue interaction accent, with semantic colors reserved for real status meaning.
- Do not pair wide decorative shadows with borders, nest cards, or use oversized radii. Elevation is functional and rare.
- New shared components must have clear multi-page reuse or state-consistency value; do not create configurable wrappers for one-off layout.
- Interactive primitives must cover hover, focus-visible, active, disabled, and pending usage while respecting reduced motion.
