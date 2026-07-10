# Codex Rules Update

## Updated Files

| File | Scope | Durable rule added |
| --- | --- | --- |
| `AGENTS.md` | Entire repository | Whole-site frontend work requires inventory, shared system, all-route coverage, states, responsive/a11y/browser QA, full verification, and phase commits |
| `src/app/AGENTS.md` | App Router pages/layouts | Preserve auth/data logic while replacing presentation; use shared page templates and flat hierarchy |
| `src/shared/components/AGENTS.md` | Shared UI and shell | Centralize control states, restrained palette, elevation/radius discipline, and reuse threshold |

## Oh My Codex Scope Decision

- The repository contains ignored `.omx` runtime state, prior plans, reports, and screenshots. These are session artifacts, not the durable source of project rules.
- The repository contains ignored `.agents` and `.claude` skill copies. `.claude/settings.local.json` already runs the Impeccable detector after UI edits.
- There is no tracked project `.codex` workflow configuration or schema-backed OMX project rule file to update safely.
- Therefore the tracked `AGENTS.md` hierarchy is used as the project-level OMX/Codex control surface. No runtime state or unknown-schema configuration was rewritten.

## Long-term Constraints Added

- Do not reduce a whole-site rebuild to token, navigation, or home-page changes.
- Inventory and cover every primary route.
- Preserve backend, data, auth, permission, and API contracts.
- Use one design system and shared page/state primitives.
- Cover loading/empty/error/success/disabled/permission states where applicable.
- Validate desktop, tablet, and mobile structure plus keyboard focus and reduced motion.
- Complete two real-browser visual QA passes and full `verify` + `build` gates.
- Protect user changes and keep redesign work in reviewable phase commits.

## User-level Configuration

- Modified: no.
- Reason: project-level tracked guidance is sufficient.
- Backup: not applicable; no user-level file was touched.
- Cross-project impact: none.

## Validation and Rollback

- Markdown rules are validated through Git diff review and repository checks.
- No JSON/YAML/TOML project configuration was changed.
- Rollback is available by switching to the original branch or reverting the dedicated rule/documentation commit; no destructive reset is required.
