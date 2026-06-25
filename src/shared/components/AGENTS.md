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
