# 002 — Make overlays interruptible

- **Status**: DONE
- **Commit**: 75711fc
- **Severity**: HIGH
- **Category**: Interruptibility, physicality, accessibility
- **Estimated scope**: 5 files, medium

## Problem

Mobile navigation, the user menu, dialogs, and toasts use one-shot entry keyframes. They unmount or close immediately, so exit has no visual continuity and rapid toggles restart from zero.

```css
/* src/app/globals.css:147 — current */
@keyframes ui-popover-in {
  from { opacity: 0; transform: translateY(-6px) scale(0.985); }
}
```

```tsx
// src/shared/components/layout/mobile-nav.tsx:73 — current
{open ? <div className="ui-overlay-enter fixed inset-0 z-50">...</div> : null}
```

```tsx
// src/shared/components/ui/toast.tsx:78 — current
const timeout = window.setTimeout(() => onDismiss(item.id), item.duration ?? 4_500);
```

## Target

- Replace keyframes with CSS transitions driven by `data-state="open|closed"`.
- Backdrops: opacity only, 160ms, `cubic-bezier(0.23, 1, 0.32, 1)`.
- Mobile drawer: `translateX(-100%) → 0`, 220ms, `cubic-bezier(0.32, 0.72, 0, 1)`.
- User menu: `translateY(-6px) scale(0.97) → none`, 180ms ease-out, `transform-origin: top right`.
- Modal: centered `scale(0.97) → 1`, 220ms ease-out using native dialog discrete transitions.
- Toast: `translateY(100%) → 0`, 220ms ease-out; on dismiss set closed state, wait 160ms, then remove.
- Under reduced motion, remove translations and scaling while keeping opacity transitions.

## Repo conventions to follow

- Shared CSS motion classes and tokens live in `src/app/globals.css`.
- `Dialog` already uses native `<dialog>`; keep that platform primitive.
- Component state remains local and uses existing React hooks; no dependency is added.

## Steps

1. Replace the three `@keyframes` blocks with data-state transition classes and native dialog `@starting-style` rules.
2. Keep mobile navigation and user-menu containers mounted, set `data-state`, `aria-hidden`, and `inert`, and preserve existing focus/escape behavior.
3. Give ToastItem a local closing state and delayed removal so open and close are symmetric.
4. Remove `ui-popover-enter` from dialogs and bind the native dialog transition class.

## Boundaries

- Do NOT change focus trapping, Escape behavior, dismissal rules, live-region semantics, or dialog business callbacks.
- Do NOT animate layout properties.
- Do NOT add a motion dependency.
- If native discrete dialog transitions fail validation, keep native dialog behavior and use opacity-only entry rather than replacing it with a custom modal implementation.

## Verification

- **Mechanical**: run `npm run verify` and `npm run build`; both must pass.
- **Feel check**: rapidly open/close the user menu and mobile drawer; motion must retarget from the current visual state. Trigger and dismiss multiple toasts; each exits before removal. At 10% playback, confirm the user menu grows from top-right and the modal from center. With reduced motion, confirm movement disappears but opacity still communicates state.
- **Done when**: all four overlay types have symmetric, interruptible state transitions and unchanged interaction semantics.
