# Frontend Redesign Audit

## Scope and Baseline

- Repository: `lab-platform`, Next.js 15 App Router + React 19 + Tailwind CSS 3.4.
- Data/auth stack: Prisma 6, PostgreSQL, NextAuth 5 beta, server components and server actions.
- Current visual baseline: neutral light/dark theme, Apple blue interaction accent, SF/system font stack, left sidebar, translucent header, rounded cards.
- Behavior freeze: `npm run verify` passed 168/168 tests before the redesign; `npm run build` passed and generated 26/26 pages.
- Existing user work at task start: untracked `.DS_Store` and `MyAdvice/CODEX_FRONTEND_APPLE_REBUILD_WITH_GIT.md`; both are excluded from redesign commits.

## Users and Core Journeys

| User | Primary goals | Critical paths |
| --- | --- | --- |
| Administrator | Govern identities, Tags, audit, settings, and project recovery | Login → overview → users / Tags / audit / settings |
| Advisor | Publish announcements, lead projects, review direct students | Login → overview → announcements / projects / progress |
| Graduate member | Read announcements, discuss work, contribute to projects, submit progress | Login → overview → posts / projects / progress / notifications |
| Progress manager | Monitor monthly submission and export reports | Login → progress period → summary / backfill / export |

The `ADMIN` governance versus `MEMBER` authoring separation is intentional and remains unchanged. Project-scoped Tags must continue to be checked with a project ID.

## Page and Route Inventory

### Public and authentication

| Route | Purpose | Current template | Redesign disposition |
| --- | --- | --- | --- |
| `/login` | Credential sign-in and graduated-account notice | Split form + photographic panel | Recompose as a restrained two-canvas auth experience; preserve sign-in behavior |
| `/change-password` | Forced and voluntary password change | Centered card | Replace with shared auth shell and explicit security guidance |

### Shared authenticated workspace

| Route | Purpose | Current template | Redesign disposition |
| --- | --- | --- | --- |
| `/` | Counts, recent announcements/projects, progress summary | KPI band + card/list grid | Rebuild hierarchy around a single overview narrative and flatter collections |
| `/403` | Permission denial | Centered card | Replace with a calm full-page denied state and clear return path |
| `/profile` | Identity, Tags, account security | Three stacked cards | Replace with one profile header and divided information sections |
| `/notifications` | Five-item notification inbox and read state | Interactive notification cards | Replace with an inbox-style divided list and explicit unread state |

### Collaboration

| Route | Purpose | Current template | Redesign disposition |
| --- | --- | --- | --- |
| `/announcements` | Paginated announcement feed | Card feed + create side card | Rebuild as editorial feed with a compact action header |
| `/announcements/[id]` | Announcement detail | Single card | Rebuild as readable article surface |
| `/announcements/new` | Publish announcement | Form card | Rebuild with shared form-page template |
| `/posts` | Published posts, drafts, post composer | Card grid + inline form | Rebuild as discussion index with divided rows and a deliberate composer panel |
| `/posts/[id]` | Post, moderation, recursive comments | Stacked cards | Rebuild as article + conversation flow |
| `/posts/[id]/edit` | Edit draft/published post | Bare form | Rebuild with shared form-page title and constrained reading width |
| `/projects` | Visible, owned, and deleted project sets | Tabs + project card grid + create card | Rebuild around section tabs, compact project objects, and header action |
| `/projects/new` | Project/advisor/member setup | Form card | Rebuild as a staged, readable form surface without changing fields |
| `/projects/[id]` | Project state, graph, members, edit tools | Header card + graph + nested tool cards | Make the graph the primary visual focus; move metadata/actions into flatter sections |
| `/projects/[id]/nodes/[nodeId]/edit` | Edit owned node | Form card | Rebuild with shared form-page shell |
| `/progress` | Period navigation, report authoring, summary, backfill, export | Toolbar + two-column card stack | Rebuild around period context, writing state, and a data-first summary layout |

### Governance

| Route | Purpose | Current template | Redesign disposition |
| --- | --- | --- | --- |
| `/admin` | Governance entry | Three non-linked cards | Rebuild as a real linked governance index |
| `/admin/users` | Paginated users, governance actions, create/import | Table + two large cards | Preserve density, improve title/action hierarchy and divided tool sections |
| `/admin/tags` | Global Tag inventory, grant/revoke, permission explanation | Table + stacked cards | Rebuild as inventory + bounded management rail |
| `/admin/audit` | Audit table, pagination, export archive | Table + shadowed archive table | Standardize data surfaces, archive empty state, and heading hierarchy |
| `/admin/settings` | Basic settings skeleton | Centered card | Rebuild as a settings form section while retaining current fields |

### Non-page states and infrastructure

- Root metadata and providers.
- Authenticated shell, desktop sidebar, mobile sheet, header, theme toggle, user menu.
- Empty states in announcement and project lists; empty notification and project-node states.
- Pending/error/success/disabled states in login, password, post, project, progress, notification, Tag, import, and governance controls.
- Horizontal-overflow handling in shared tables and commit graph.
- No dedicated route-level `loading.tsx` or `error.tsx`; current server work generally resolves before render. The redesign will use reusable inline state surfaces and preserve truthful loading behavior instead of adding fake loaders.

## Current Experience Problems

1. The flat navigation list mixes collaboration, personal, and governance destinations. Users must infer grouping from icon order.
2. Page titles and primary actions are inconsistent or absent. Several pages begin directly with a card or table.
3. The same bordered card treatment is used for articles, forms, summaries, list rows, permission explanations, and empty states, flattening information priority.
4. Forms repeat custom `select` class strings and local feedback styles, creating inconsistent heights, radii, focus treatment, and error placement.
5. Announcement, notification, project, and post collections use different item grammars even when their interaction model is similar.
6. Dashboard metrics and content blocks are serviceable but still read as a generic admin template rather than a deliberate product overview.
7. Project detail gives its metadata card equal weight to the commit graph, although the graph is the core task surface.
8. The admin index describes tools but does not navigate to them.
9. Empty states mostly state absence; few explain the next useful action or why an area is unavailable.
10. Some mobile layouts rely on wrapping desktop controls rather than a purpose-built order, especially progress navigation, pagination, governance actions, and project tools.

## Frontend Architecture Problems

- Semantic tokens exist, but spacing, page widths, content rhythm, control styles, and feedback treatments are still encoded repeatedly in page class strings.
- `Card` is used as a generic layout wrapper rather than an object boundary.
- No shared page-header, section-heading, select, empty-state, or inline-feedback primitives exist.
- `--shadow-card` remains in use on ordinary UI chrome, conflicting with the target flat/hairline elevation model.
- Existing route files are appropriately thin and security-first; this part should be retained.
- Feature-sliced boundaries are healthy. The redesign should work inside the existing `app → features → shared` dependency direction rather than create a second component architecture.

## AGENTS and OMX Rule Audit

- Root and nested `AGENTS.md` files correctly protect auth, permission, Tag scope, and feature boundaries, but previously lacked durable whole-site redesign and visual-QA completion rules.
- Project `.agents`, `.claude`, `.omc`, and `.omx` directories exist but are ignored runtime/tool state. `.claude/settings.local.json` already contains the Impeccable UI hook; `.omx` contains prior plans and screenshots, not a durable tracked project workflow surface.
- No tracked project `.codex` configuration exists. Root/nested `AGENTS.md` is the safest durable OMX control surface for this repository.
- User-level Codex/OMX configuration is not required and will not be modified.
- Existing tool state must not be rewritten or committed merely to satisfy the task; durable rules belong in tracked `AGENTS.md` and documentation.

## Skill Rule Mapping

- Enabled skill: `awesome-design-md`.
- Skill path: `/Users/gaussprime/.codex/skills/awesome-design-md/SKILL.md`.
- Apple reference: `/Users/gaussprime/.codex/skills/awesome-design-md/design-md/apple/DESIGN.md`.
- Supporting execution skill: Impeccable product register from `.agents/skills/impeccable/reference/product.md`.

| Skill principle | Project mapping |
| --- | --- |
| Single interaction accent | Blue is reserved for links, current selection, focus, and primary actions |
| Near-invisible chrome | Remove decorative card shadows; use neutral surface changes and hairline dividers |
| Strong typographic hierarchy | Shared page titles, section titles, body, supporting copy, labels, and tabular data |
| Purposeful whitespace | Larger page-header/section rhythm while keeping data tables compact |
| Product UI familiarity | Preserve standard navigation, tables, forms, and controls; no marketing choreography on tools |
| Restrained motion | 160–220ms state transitions only, with reduced-motion support |
| Responsive structure | Grouped desktop navigation, mobile sheet, reflowed actions, scrollable data surfaces |

## Apple-style Gap Analysis

- The current palette is close to the requested direction, but the experience still depends on bordered rounded containers to establish nearly every hierarchy.
- `/admin`, `/profile`, `/posts`, `/announcements`, and `/projects` have no dominant page-level focus; repeated cards compete at equal weight.
- `/login` has a large dark visual region, but its glassy text card, border, and wide shadow add decorative chrome instead of allowing the image and typography to lead.
- `/` and `/admin/users` feel like conventional SaaS dashboard templates because metrics, tables, and forms are framed as modular boxes without a continuous page rhythm.
- `/projects/[id]` should be immersive around the commit graph; the current metadata card delays the primary task and the lower tools create nested-card density.
- Forms and governance pages should remain efficient tools. They should borrow Apple-like precision, restraint, and spacing rather than imitate product-launch sections.
- Typography is generally restrained but lacks a consistent display/page/section scale across routes.
- Current dark mode is usable, but surfaces are close in value and rely on borders; the redesign needs clearer neutral layers without glow or heavy shadow.
- Motion is appropriately limited; the remaining work is to standardize state transitions and avoid hover translation on list objects.
- Old components to replace or substantially rewrite: generic `Card` usage patterns, flat sidebar IA, page-local CTA strings, card-based announcement/post/notification rows, and ad-hoc select controls.
- Components to keep and restyle: permission-safe route composition, button/input primitives, data table, commit graph behavior, markdown editor/renderer, pagination logic, and all business actions.

## Preserve / Rewrite / Delete

### Preserve

- Server actions, Prisma filters, permission/session calls, redirects, route URLs, validators, and database/API contracts.
- Feature-sliced imports and shared security architecture.
- Existing responsive commit-graph logic and keyboard-operable column resizing.
- Existing test suite as the regression lock.

### Rewrite

- App shell information grouping and navigation presentation.
- Global tokens for surface, typography, spacing, radius, focus, and elevation.
- Shared UI primitives and new page/state primitives.
- All primary page composition and feature-component visual markup.
- Responsive ordering and small-screen action layouts.

### Delete

- Decorative `--shadow-card` usage on ordinary cards, tables, menus, and graph chrome.
- Repeated page-local button/select styles that duplicate shared primitives.
- Card wrappers that exist only to separate ordinary adjacent content.
- Hover lift effects and visual treatments that imply clickability without adding information.

## Risks and Controls

| Risk | Control |
| --- | --- |
| Business behavior regression | Do not edit server actions/security core; compare diffs; run 168-test gate and E2E flows |
| Permission affordance drift | Keep current conditional rendering and navigation access map intact |
| Mobile overflow | Validate 390/768/1024/1440; retain table/graph scroll strategies |
| Dark-theme contrast | Validate representative routes in both themes and adjust semantic tokens centrally |
| Large unreviewable diff | Use five phase commits and exact-path staging |
| User changes mixed into commits | Keep initial untracked files un-staged and report them at final Git acceptance |
