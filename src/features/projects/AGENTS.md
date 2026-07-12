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
- `Project.leaderId` is canonical. The corresponding `project-lead:{projectId}` projection and `ProjectMember` row must be updated atomically under lifecycle → project locks. The leader must be an active, resolved direct master/doctor student of an active, resolved mentor advisor. Suspension, graduation, role/degree/advisor changes, or deletion revoke invalid live leadership and set `leaderNeedsReassignment` only for active unfinished projects; never silently promote another member.
- Reactivation (`restore`/`unarchive`) must lock actor, advisor, and leader lifecycles before the project, re-read responsibility IDs, reject an invalid advisor, and reconcile an invalid leader before exposing the project. Archive, completion, soft deletion, and hard deletion must not leave a terminal project marked for reassignment.
- A mentor with unfinished projects, including soft-deleted recoverable projects, cannot be suspended, changed to a non-mentor role/identity, or deleted. Restore and archive/complete those projects, or hard-delete them, before invalidating the mentor. Once all remaining projects are terminal, invalidated leader authority is revoked while attribution snapshots remain available. Only an active administrator or the responsible advisor holding `project.update_advised` may choose a replacement through the explicit flow.

### Testing Requirements
- Project-scoped permission computation is covered in unit tests; status triggers, migration eligibility, lifecycle/advisor reconciliation, leader projection, and concurrency require the disposable PostgreSQL integration runner plus browser archive/member-denial coverage.

## Dependencies

### Internal
- `@/shared/lib/authorization` (project variant), `@/shared/lib/permissions`, `@/shared/lib/session`, `@/shared/lib/prisma`, `@/shared/lib/validators/projects`.

### External
- Prisma, Zod, React.

<!-- MANUAL: -->
