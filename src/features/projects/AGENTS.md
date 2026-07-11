<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# projects (feature)

## Purpose
Project lifecycle and project-scoped collaboration: create projects, add timeline nodes (milestones/updates/decisions/issues/resources), and archive. This is the feature where **project-scoped Tag permissions** matter — capabilities like `project-lead:{projectId}` / `project-member:{projectId}` must be checked against the specific `projectId`.

## Key Files
| File | Description |
|------|-------------|
| `actions/create-project.ts` | Creates a project (requires `project.create`) |
| `actions/create-node.ts` | Adds a `ProjectNode` to a project (requires `project.node.create`, scoped to the project) |
| `actions/archive-project.ts` | Archives a project (requires `project.manage`) |
| `components/project-list.tsx` | Project listing |
| `components/project-form.tsx` | Create/edit form |
| `components/project-detail.tsx` | Project detail view |
| `components/commit-graph-view.tsx` | Active project-node graph view |
| `components/project-node-views.tsx` | Project-node view composition |
| `index.ts` | Barrel export |

## For AI Agents

### Working In This Directory
- **Project Tags must never cross projects.** Use `assertProjectPermissionWithAudit({ ..., projectId })` / `getProjectPermissions(userId, projectId)`. The global `getUserPermissions` deliberately ignores project-scoped tags, so checking it here would be a privilege-escalation bug.
- Filter soft-deleted projects/nodes with `deletedAt: null`; archiving sets `archivedAt`/`status = ARCHIVED` rather than deleting. Archive/unarchive is available to active `ADMIN`, the canonical project leader, or an actor with the project-scoped management permission; ordinary members are denied server-side.
- `PLANNING` / `IN_PROGRESS` is derived from non-deleted node count. `ARCHIVED` and `COMPLETED` take priority. Use `deriveProjectStatus` and keep the database triggers/integration tests aligned.
- `Project.leaderId` is canonical. The corresponding `project-lead:{projectId}` projection must be updated atomically under project locks. Deleting an active leader sets `leaderNeedsReassignment`; do not silently promote another member.

### Testing Requirements
- Project-scoped permission computation is covered in unit tests; status triggers, leader projection, and concurrency require the disposable PostgreSQL integration runner plus browser archive/member-denial coverage.

## Dependencies

### Internal
- `@/shared/lib/authorization` (project variant), `@/shared/lib/permissions`, `@/shared/lib/session`, `@/shared/lib/prisma`, `@/shared/lib/validators/projects`.

### External
- Prisma, Zod, React.

<!-- MANUAL: -->
