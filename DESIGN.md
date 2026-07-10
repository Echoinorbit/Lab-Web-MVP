# Lab Platform Design System

## Direction

The product is a calm research-operations workspace. It borrows Apple-like restraint—clear hierarchy, generous orientation space, neutral material layers, precise typography, and a single interaction accent—without copying Apple assets, layouts, or product-launch language.

The source references for this rebuild are the repository `awesome-design-md` skill, its Apple `DESIGN.md`, the Impeccable product register, and `docs/frontend-redesign-plan.md`. When guidance conflicts, business truth and accessible task completion win.

## Physical Context

The primary scene is repeated daily work on a lab or office laptop in normal indoor light. Phone use is occasional but must support complete forms and navigation. Light mode is the default high-clarity canvas; dark mode is a first-class late-work surface.

## System Rules

- Use neutrals for canvas, surfaces, dividers, and typography.
- Reserve blue for links, focus, current selection, and primary actions.
- Reserve green, amber, and red for truthful status meaning.
- Prefer typography, whitespace, dividers, and surface contrast over card stacks.
- Use a bordered surface only for an independent object, bounded tool, table, form, or overlay.
- Do not use decorative gradients, frosted content cards, hover lift, glow, or wide shadows.
- Shadows are reserved for overlays that must detach from the page.
- Keep operational pages dense enough to compare information; do not turn them into marketing pages.

## Tokens

The semantic source of truth lives in `src/app/globals.css` and is mapped by `tailwind.config.ts`.

### Color

- `background`: application canvas.
- `card`: primary content surface.
- `surface` / `surface-raised`: secondary and overlay layers.
- `foreground` / `muted-foreground`: primary and supporting copy.
- `border` / `input`: hairlines and control outlines.
- `primary`: interaction blue.
- `success`, `warning`, `destructive`: semantic state colors.

### Typography

- Display/page title: 32–40px, semibold, tight tracking.
- Section title: 20–24px, semibold.
- Object title: 16–18px, semibold.
- Body/control: 15–17px.
- Supporting/meta: 12–14px with normal sentence casing.
- Long-form content: maximum 70–75 characters per line and relaxed leading.

### Layout and Shape

- Structural rhythm: 8px base, with 12/16/24/32/48px steps.
- Page gutter: 16px phone, 24px tablet, 32–48px desktop.
- Data workspace maximum: 1440px. Reading/form width is narrower by task.
- Standard control height: 44px. Compact control height: 36–40px.
- Standard surface radius: 12–16px. Full pills are limited to compact statuses or segmented actions.

### Motion and Layering

- State transition: 160ms; overlay transition: 220ms; one fluid ease.
- Motion communicates state only. `prefers-reduced-motion` removes it globally.
- Layer order: content → sticky chrome → backdrop → sheet/popover.

## Shared Components

- `Button`, `Input`, `Textarea`, `Select`, `Badge`: canonical control and state grammar.
- `PageHeader`, `SectionHeader`: route and section hierarchy.
- `EmptyState`, `StatusNotice`: reusable state communication.
- `Card`: bounded surface, not a generic spacing wrapper.
- `DataTable`, `Pagination`: dense governance and reporting tools.
- Sidebar/header/mobile navigation: one grouped information architecture across breakpoints.

## Accessibility Contract

- Use semantic links, buttons, inputs, labels, headings, lists, and tables.
- Keep a visible `focus-visible` treatment on every interaction.
- Primary touch targets are at least 44px; compact table actions remain keyboard reachable.
- Do not encode current, selected, unread, error, or disabled state with color alone.
- Preserve truthful server-side permission checks and native form behavior.
- Keep tables and graphs horizontally scrollable when reflow would destroy meaning.

## Review Checklist

1. Is there one obvious page purpose and primary action?
2. Can a container be removed in favor of spacing or a divider?
3. Is blue used only for interaction or focus?
4. Are all controls using shared primitives and complete states?
5. Does the route remain usable at 390, 768, 1024, and 1440px?
6. Do keyboard focus, dark contrast, empty/error/pending states, and reduced motion remain clear?
