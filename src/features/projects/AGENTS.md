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
| `components/timeline.tsx` | Node timeline |
| `components/node-card.tsx` | Single node display |
| `index.ts` | Barrel export |

## For AI Agents

### Working In This Directory
- **Project Tags must never cross projects.** Use `assertProjectPermissionWithAudit({ ..., projectId })` / `getProjectPermissions(userId, projectId)`. The global `getUserPermissions` deliberately ignores project-scoped tags, so checking it here would be a privilege-escalation bug.
- Filter soft-deleted projects/nodes with `deletedAt: null`; archiving sets `archivedAt`/`status = ARCHIVED` rather than deleting.
- README notes the project list still shows sample data; wire pages to these actions and real queries rather than re-implementing the permission logic.

### Testing Requirements
- Project-scoped permission computation is covered in `tests/permissions.test.ts`. Run `npm run verify`.

## Dependencies

### Internal
- `@/shared/lib/authorization` (project variant), `@/shared/lib/permissions`, `@/shared/lib/session`, `@/shared/lib/prisma`, `@/shared/lib/validators/projects`.

### External
- Prisma, Zod, React.

<!-- MANUAL: -->
