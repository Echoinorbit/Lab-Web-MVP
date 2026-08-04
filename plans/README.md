# Frontend motion plans

| Number | Plan | Severity | Status |
| --- | --- | --- | --- |
| 001 | Make shared feedback physical | MEDIUM | DONE |
| 002 | Make overlays interruptible | HIGH | DONE |
| 003 | Remove noisy motion and bridge state | MEDIUM | DONE |

Recommended order: `001` → `002` → `003`. Plan 002 reuses the motion tokens established in plan 001; plan 003 is independent but should be reviewed after the shared primitives are stable.
