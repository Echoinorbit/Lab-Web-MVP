# 003 — Remove noisy motion and bridge state

- **Status**: DONE
- **Commit**: 75711fc
- **Severity**: MEDIUM
- **Category**: Purpose and frequency, missed opportunities
- **Estimated scope**: 5 files, small

## Problem

Project cards reveal a duplicate hover preview on a frequently scanned grid, including touch devices that can retain false hover. Conversely, notification read state and theme icons teleport with no state continuity.

```tsx
// src/features/projects/components/project-list.tsx:65 — current
{project.canPreview ? (
  <div data-project-preview className="ui-popover-enter ... group-hover:block group-focus-within:block">...</div>
) : null}
```

```tsx
// src/features/notifications/components/notification-list.tsx:67 — current
notification.isRead ? "bg-card" : "bg-primary/[0.045]"
```

## Target

- Delete the project hover preview and its `canPreview` presentation prop.
- Notification row background uses a 160ms color transition with the shared ease-out token.
- Sun and moon icons remain mounted in one grid cell and crossfade over 160ms; a subtle `scale(0.9) → 1` is allowed only when reduced motion is off.
- Normalize any touched hover/color transitions to shared duration and easing tokens.

## Repo conventions to follow

- Presentation state is expressed with `cn` and semantic tokens.
- Theme persistence remains in `src/shared/components/layout/theme-toggle.tsx`; only the icon presentation changes.

## Steps

1. Delete the project preview markup and remove `canPreview` from `ProjectSummary` plus page mappings/imports that exist only for it.
2. Add a tokenized color transition to notification rows.
3. Render both theme icons in a shared grid position and crossfade them using opacity/transform transitions.
4. Normalize touched list title/row transitions to shared tokens.

## Boundaries

- Do NOT change project visibility queries or permission checks.
- Do NOT change notification mutation/query behavior.
- Do NOT animate list entry or page arrival.
- Do NOT add a motion dependency.

## Verification

- **Mechanical**: run `npm run verify`; expect all existing tests to pass and no unused visibility imports.
- **Feel check**: scan and tap project cards at phone and desktop widths; no hover-only duplicate should appear. Toggle a notification read state and the theme; state changes should remain legible without drawing attention. With reduced motion, theme icons crossfade without scaling.
- **Done when**: frequent hover motion is gone and the two genuine state swaps have restrained continuity.
