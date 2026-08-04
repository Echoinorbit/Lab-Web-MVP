# Animation opportunities

The product is used repeatedly throughout the day, so motion is reserved for feedback, spatial explanation, and state continuity. Vocabulary follows the shared animation glossary.

| Opportunity | Frequency | Motion | Exact target | Decision |
| --- | --- | --- | --- | --- |
| Primary and icon controls | Tens/day | Press / Tap feedback | `scale(0.97)`, 160ms, `cubic-bezier(0.23, 1, 0.32, 1)` | Add globally; remove transform for reduced motion |
| Mobile navigation | Occasional | Direction-aware transition | Backdrop opacity 160ms; sheet `translateX(-100%) → 0` in 220ms with `cubic-bezier(0.32, 0.72, 0, 1)` | Add symmetric, interruptible open/close |
| User menu | Occasional | Origin-aware animation | `translateY(-6px) scale(0.97) → none`, 180ms ease-out, origin top-right | Add symmetric, interruptible open/close |
| Dialogs and toasts | Occasional | Interruptible animation | Modal `scale(0.97)`, toast `translateY(100%)`; opacity retained in reduced motion | Replace one-shot keyframes |
| Theme and read-state swaps | Occasional | Crossfade | Opacity + small scale, 160ms; no movement for reduced motion | Add to prevent teleporting state |

## Rejected candidates

| Candidate | Why rejected |
| --- | --- |
| Page-load entrance and list stagger | Operational pages are revisited constantly; repeated entrances make navigation feel slower. |
| Sidebar route movement | Navigation is used tens of times per day; color and shape are sufficient state indicators. |
| Project hover preview | Duplicates visible content, behaves poorly on touch, and adds a frequent hover animation with no decision value. |
| Graph/chart decorative motion | Data interpretation is the job; decorative motion would compete with functional state. |

**Verdict:** motion belongs in controls, overlays, and genuine state changes—not in page arrival or routine scanning.

