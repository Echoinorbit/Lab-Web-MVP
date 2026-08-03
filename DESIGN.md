# Lab Platform — Apple-aligned interface system

## Product posture

The interface is a calm collaboration workspace. It should help people understand where they are, what changed, and what action is available without turning operational work into a decorative dashboard.

Roles, Tag capabilities, project scope, server-side authorization, URL contracts, and workflow states remain product invariants. This document governs presentation and interaction only.

## Human needs first

- **Clarity:** content and actions lead; decoration stays subordinate.
- **Deference:** controls use one restrained blue accent, neutral surfaces, and compact hierarchy.
- **Depth:** material, overlap, and motion explain spatial relationships only when a layer actually moves above another.
- **Directness:** every interactive object gives immediate press, focus, pending, or selection feedback.
- **Continuity:** menus, drawers, dialogs, and toasts preserve their spatial origin and remain interruptible.

## Shared visual language

- System fonts, optical sizing, tabular numerals for data, and modest title scale create a familiar reading rhythm.
- Page headers use typography and whitespace rather than decorative orientation marks.
- Cards and tables use a consistent 16px surface radius. Ordinary sections remain unboxed.
- Blue communicates action, focus, and selected context. Semantic colors keep literal status meaning.
- The desktop sidebar is stable and quiet. Active navigation uses a subtle tonal selection instead of a bright floating tile.
- Sticky toolbars and popovers may use translucent material. Material lives on a pointer-inert pseudo-layer when applying it to an ancestor could change fixed-position behavior.

## Responsive architecture

- `390px`: single-column canvas, complete forms, and a viewport-fixed navigation drawer.
- `768px`: wider gutters and selective two-column layouts.
- `1024px`: persistent desktop navigation becomes available.
- `1440px+`: data-heavy tools gain width while reading surfaces stay bounded.

Tables and graphs scroll horizontally when reflow would destroy meaning. The entire workflow must remain usable at every target width.

## Motion and feedback

- Press feedback: `scale(0.97)`, 160ms, strong ease-out.
- Popovers: origin-aware `translateY(-6px) scale(0.97)`, 160ms.
- Mobile drawer: direction-aware `translateX(-100%)`, 220ms.
- Dialogs: centered `scale(0.97)`, 220ms.
- Toasts: enter and exit through `translateY(100%)`, then unmount after exit.

Page arrival and routine list scanning do not animate. CSS transitions are preferred so reversible UI can retarget from its current state. Reduced motion removes spatial movement while retaining state feedback.

## Accessibility and material fallbacks

- Semantic landmarks, labels, accessible names, visible keyboard focus, and practical touch targets are required.
- Closed overlays remain mounted but inert and hidden from assistive technology.
- `prefers-reduced-motion` removes transform movement.
- `prefers-reduced-transparency` replaces translucent materials with solid surfaces.
- `prefers-contrast: more` strengthens material boundaries.
- Selected, unread, denied, pending, and destructive states never rely on color alone.

## Review questions

1. Is the primary task obvious before the user inspects every surface?
2. Does each layer explain a real spatial relationship?
3. Is identity presented truthfully, including historical and deleted states?
4. Can every action be completed with keyboard and at 390px width?
5. Does feedback remain understandable with reduced motion and transparency?
