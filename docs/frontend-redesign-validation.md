# Frontend Redesign Validation

Validated on 2026-07-10 on the dedicated branch `refactor/apple-frontend-rebuild`.

## Scope and Acceptance Matrix

The validation covered the 22 routes recorded in `docs/frontend-redesign-audit.md`, including authentication, the shared workspace, announcements, posts, projects, progress reporting, notifications, profile and all governance pages. Dynamic detail and edit routes were exercised with local E2E fixtures so the review did not depend on empty placeholders.

The browser matrix covered:

- 390px mobile;
- 768px tablet;
- 1024px compact desktop;
- 1440px wide desktop;
- light and dark themes;
- default and `prefers-reduced-motion` behavior;
- public, member and administrator states.

## Visual QA Round One

The first real-browser pass checked information architecture, page focus, global consistency, navigation, forms, data states, responsive layout, overflow and remaining legacy styling.

Issues found during this pass were fixed before the second pass:

- moved the authenticated shell breakpoint to `xl` so intermediate widths use the mobile drawer instead of compressing desktop navigation;
- added mobile-drawer focus trapping, Escape dismissal, focus return and body scroll locking;
- removed narrow-layout overflow in governance Tag summaries and tables;
- removed an empty administration column from the posts layout;
- made project member selection update from current state so rapid checkbox changes cannot lose selections;
- restored exact lifecycle and progress action copy required by the existing business flows;
- prevented the login photograph from loading below the desktop breakpoint and removed it from the accessibility tree;
- corrected dark-theme destructive-action contrast;
- removed global smooth scrolling that delayed programmatic focus and browser-test interaction coordinates.

## Visual QA Round Two

The second pass reloaded every route after each viewport transition and rechecked typography, spacing, alignment, visual weight, hover/focus/active states, transition restraint, card usage, product identity and mobile finish.

Observed evidence:

- every tested viewport reported `scrollWidth === viewport width` and no unexpected overflow nodes;
- browser console, runtime and network-failure collections were empty;
- the login visual asset was requested only at desktop width and exposed zero accessibility image nodes;
- ordinary transitions measured 0.15–0.22 seconds;
- reduced-motion transitions measured approximately 0.000001 seconds;
- mobile drawer focus stayed inside the drawer and returned to the trigger after close;
- tables and the project graph retained deliberate horizontal-scroll behavior on narrow screens;
- light-theme contrast ratios were 16.13 for foreground, 5.94 for muted text, 4.84 for primary and 6.03 for destructive;
- dark-theme contrast ratios were 16.88 for foreground, 7.76 for muted text, 6.27 for primary and 4.59 for destructive.

Representative screenshots were inspected at mobile and desktop widths for login, users, Tags and project detail. QA screenshots remain under ignored `.omx/reports/` and are intentionally not part of the Git history.

## Functional Browser Validation

`npm run e2e:smoke` passed against the rebuilt interface and verified the expected runtime markers and 23 notification rows.

The project-canvas runtime probe passed with:

- 11 nodes across 3 lanes;
- working inspector and project actions;
- persisted inspector resize from 156px to 196px;
- light and dark screenshots at 390px, 768px and 1280px;
- normal and reduced-motion timing checks.

The final `npm run e2e:browser` run (`mrepz2dj`) passed after a clean development-server restart. It exercised:

- administrator delegated project creation and the full delete/restore/hard-delete lifecycle;
- Excel template download and user import;
- member creation, identity editing, duplicate-student-ID rejection and Tag grant;
- Shanghai-time audit rendering;
- forced first-password change and subsequent login;
- post, comment and reply creation plus reply collapse/reset;
- domain-notification fan-out;
- advisor and project-lead permissions;
- announcement, notification, progress and project-fixture read flows;
- project preview, author selection and resizer persistence;
- graduation confirmation and rejected login for the graduated account;
- hostile post rendering without unsafe execution;
- automatic cleanup of the run's two users and one project.

## Engineering Gates

| Gate | Result |
| --- | --- |
| Formatter | No dedicated formatter script exists; no formatter was invented or added. ESLint's zero-warning gate passed. |
| `npm run typecheck` | Passed, including `prisma generate` and `tsc --noEmit`. |
| `npm run lint` | Passed with `--max-warnings=0`. |
| `npm run test` | Passed: 168 tests, 0 failures. |
| `npm run prisma:validate` | Passed. |
| `npm run verify` | Passed end-to-end with all checks above. |
| `npm run build` | Passed on Next.js 15.5.19; 26 static pages generated successfully. |
| `npm audit --audit-level=moderate` | Passed: 0 vulnerabilities. |
| `npm run e2e:smoke` | Passed. |
| `npm run e2e:browser` | Passed with final run ID `mrepz2dj`; cleanup passed. |

The root and scoped `AGENTS.md` files are Markdown guidance, and no JSON, YAML or TOML project configuration was added or rewritten. Project-level rules were sufficient, so no user-level Codex or Oh My Codex configuration was modified.

## Known Non-blocking Notes

- Prisma prints its existing notice that `package.json#prisma` configuration will be removed in Prisma 7. The current Prisma 6 validation succeeds; migrating that configuration is outside this front-end rebuild.
- Running `next build` while `next dev` shared the same `.next` directory invalidated the already-running development server. Restarting the server restored it, and the complete browser run then passed. This is a local process-order constraint, not an application failure.

All planned front-end changes are covered by fresh static, build, browser, responsive, accessibility and Git validation evidence. No production deployment or remote Git operation is part of this acceptance.
