# Frontend Redesign Plan

## Experience Definition

The redesigned product is a calm research operations workspace: dense when users compare records, spacious when they orient or compose, and explicit about authority and state. Apple-inspired qualities come from hierarchy, whitespace, neutral surfaces, precise typography, a single interaction accent, and quiet state transitions—not copied content or launch-page theatrics.

Physical scene: users repeatedly operate this product on office/lab laptops under normal indoor light, occasionally completing forms on a phone; the default experience is light and high-clarity, with a fully supported dark theme for late work.

Color strategy: restrained. Neutral canvas and surface layers carry the application; blue appears only for interaction, selection, focus, and primary actions. Semantic red/amber/green are reserved for real error, warning, and success meaning.

## Information Architecture

Desktop navigation is grouped rather than flat:

- Workspace: overview, announcements, posts, projects, progress.
- Personal: notifications and profile access through the header.
- Governance: users, Tags, audit, settings, shown only when existing access rules allow them.

Mobile retains the same grouping inside a sheet. The header supplies global context, notification state, theme, and account controls. No fake search is added.

## Shared Page Templates

1. Overview: display title → compact metric strip → recent work collections → contextual summary.
2. Index/list: page header with primary action → tabs/filters → flat collection/table → pagination.
3. Detail/article: context/back link → title/meta → readable body → related actions/conversation.
4. Form/workflow: page header → bounded form width → grouped fields → inline feedback → sticky/clear actions only when needed.
5. Governance/data: title/status summary → data table → secondary management tools with lower visual weight.
6. Immersive tool: project context → graph as dominant surface → supporting members and edit tools below/alongside.
7. State: permission, empty, error, and success surfaces with icon/title/explanation/action and no decorative card stack.

## Design System Implementation

### Tokens

- Semantic color layers: canvas, surface, raised surface, ink, secondary/muted copy, hairline, interaction blue, semantic status colors.
- Typography: display/page/section/body/supporting/caption/label/control roles using the existing SF/system stack.
- Layout: 8px structural rhythm, responsive page gutters, 1320–1440px data max width, 65–75ch reading width.
- Shape: 10–16px bounded surfaces, pill actions/tabs, full-bleed/flat ordinary sections.
- Elevation: borders and surface changes by default; restrained popover shadow only where an overlay must detach.
- Motion: 160–220ms state transitions with one exponential ease and reduced-motion fallback.
- Layering: content, sticky chrome, overlay backdrop, popover/sheet.

### Shared primitives to add or consolidate

- `Select`: one focus/disabled/error-ready control grammar for all existing native selects.
- `PageHeader` and `SectionHeader`: consistent page purpose, supporting copy, and action placement.
- `EmptyState`: teach the area and expose a next step when one exists.
- `StatusNotice`: inline info/success/warning/error feedback without card nesting.
- Existing `Button`, `Input`, `Textarea`, `Badge`, `Card`, `Pagination`, `DataTable`, and shell components are restyled rather than replaced with a new dependency.

No new package is planned. Native controls, existing React/Next.js behavior, Tailwind, and Lucide cover the requirement.

## Route-by-route Implementation

### Shell and shared chrome

- Group sidebar navigation and reduce inactive visual noise.
- Rebuild header spacing, mobile sheet, user menu, and theme toggle with shared layers/focus behavior.
- Add skip-link/landmark support and stable responsive page gutters.

### Auth and state pages

- `/login`: remove glass-card decoration; let image, restrained dark canvas, and concise hierarchy lead.
- `/change-password`: shared auth composition and explicit password context.
- `/403`: full-page denied state aligned with product language.

### Workspace

- `/`: stronger welcome/purpose header; flatter metrics; editorial announcement list; project collection; data-first progress summary.
- `/announcements*`: article/feed hierarchy, direct publish CTA, detail reading width, shared form template.
- `/posts*`: divided discussion list, clear composer boundary, article detail and flatter threaded conversation.
- `/projects`: header action, segmented tabs, project objects with useful preview and less chrome.
- `/projects/[id]`: graph becomes the dominant section; project state/actions are concise; members and edit tools become subordinate.
- `/progress`: period context first, writing state second, manager summary dominant when present; mobile order remains usable.
- `/notifications`: inbox rows with explicit read state and accessible action controls.
- `/profile`: single identity composition with separated fields, Tags, and security action.

### Governance

- `/admin`: actual linked governance directory.
- `/admin/users`: retain dense table; improve summary, pagination, governance details, create/import tools.
- `/admin/tags`: inventory first, grant/revoke second, permission explanation last.
- `/admin/audit`: standardized data table and archive section; no decorative shadows.
- `/admin/settings`: restrained settings section using shared form controls.

## Responsive Strategy

- 390px: one-column flow, full-width primary actions where helpful, grouped pagination, horizontal table/graph scroll with visible affordance, mobile sheet navigation.
- 768px: tablet gutters, two-column object grids only where content supports it, compact grouped header actions.
- 1024px: desktop navigation and two-pane work surfaces activate; graph inspector remains usable.
- 1440px: content locks to the intended max width; whitespace absorbs additional width.
- Typography changes at structural breakpoints, not fluid marketing scales.

## Accessibility and State Strategy

- Keep semantic buttons/links/labels and native inputs.
- Minimum 44px primary controls; compact data-table controls retain adequate focus targets.
- Visible `focus-visible` ring on every interactive component.
- Current/selected/read states include text or shape, not color alone.
- Reduced-motion rules remain global.
- Tables retain headings and scroll containers; interactive card-like rows use real links/buttons.
- Existing server-rendered truth is preserved; no fake client-only permission hiding.

## Deletion and Replacement Map

- Delete ordinary card shadows, hover lift, duplicated select/button class strings, and card-only section wrappers.
- Replace flat nav with grouped IA.
- Replace repeated announcement/post/notification card rows with purpose-specific flat collection rows.
- Replace page-local titles/actions with shared headers.
- Retain Card only for independent tools, project objects, and bounded form/overlay surfaces.

## Validation Plan

1. After shared system/shell: typecheck + lint + representative static review.
2. After route replacement: full `npm run verify` and `npm run build`.
3. Real browser pass one: authenticated routes for admin and member at 390/768/1024/1440, both themes on representative pages; fix IA, overflow, navigation, forms, and old-style residue.
4. Real browser pass two: typography, spacing, alignment, focus, active/disabled states, dark contrast, and Apple-style gap questions; fix findings.
5. Run existing E2E smoke/browser flows when the local database/browser fixtures are available.
6. Review exact Git diff and staged diff before every phase commit.

## Stop Condition

Stop only after all primary routes use the shared system, the two visual passes produce no material defects, behavior/security tests and production build pass, phase commits exist, and final Git acceptance reports the preserved user files separately.
