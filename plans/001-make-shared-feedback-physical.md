# 001 — Make shared feedback physical

- **Status**: DONE
- **Commit**: 75711fc
- **Severity**: MEDIUM
- **Category**: Physicality, accessibility, cohesion
- **Estimated scope**: 4 files, small

## Problem

Shared controls change color but provide no physical press feedback. The global reduced-motion rule then removes every transition, including useful focus and color feedback.

```tsx
// src/shared/components/ui/button.tsx:39 — current
"inline-flex ... transition-[color,background-color,border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-fluid)] ..."
```

```css
/* src/app/globals.css:181 — current */
*::after {
  animation-duration: 0.001ms !important;
  transition-duration: 0.001ms !important;
}
```

The skip link also animates when keyboard users request it:

```tsx
// src/app/(dashboard)/layout.tsx:28 — current
className="... -translate-y-20 ... transition-transform focus:translate-y-0"
```

## Target

- Add `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` and `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` to the global token set.
- Shared buttons and button-styled links use `active:scale-[0.97]` with a 160ms transform transition.
- Under `prefers-reduced-motion: reduce`, press transforms are disabled but opacity, color, and focus transitions remain.
- The skip link appears immediately on focus with no transform transition.

## Repo conventions to follow

- Motion tokens live in `src/app/globals.css` and are consumed by Tailwind arbitrary values.
- `src/shared/components/ui/button.tsx` is the canonical source for both buttons and button-styled links.

## Steps

1. Add exact ease-out and drawer curves beside the existing duration tokens in `src/app/globals.css`.
2. Extend `buttonStyles` to transition transform and apply `active:scale-[0.97]` with a reduced-motion reset.
3. Remove the global `0.001ms` nuke; retain gentle opacity/color feedback while removing movement from named motion classes.
4. Remove `transition-transform` from the dashboard skip link.

## Boundaries

- Do NOT change button semantics, variants, sizes, or disabled behavior.
- Do NOT add a motion dependency.
- Do NOT animate keyboard-triggered navigation or page arrival.

## Verification

- **Mechanical**: run `npm run verify` and expect typecheck, lint, tests, and Prisma validation to pass.
- **Feel check**: press primary, secondary, ghost, and destructive controls; confirm scale is subtle and release is immediate. Toggle reduced motion and confirm the scale disappears while focus and color changes remain.
- **Done when**: every shared control has consistent 0.97 press feedback, the skip link is instant, and reduced motion preserves non-positional state feedback.
