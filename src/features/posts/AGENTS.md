<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-06-23 | Updated: 2026-06-23 -->

# posts (feature)

## Purpose
Discussion posts and threaded comments. Provides the post list/detail UI, the post authoring form, and the comment section. Posts are categorized (`GENERAL`, `EXPERIENCE`, `TUTORIAL`, `DISCUSSION`, `RESOURCE`) and comments support one-level replies.

## Key Files
| File | Description |
|------|-------------|
| `components/post-list.tsx` | Post listing |
| `components/post-detail.tsx` | Single post view |
| `components/post-form.tsx` | Create post (markdown body) |
| `components/comment-section.tsx` | Threaded comments and replies |
| `index.ts` | Barrel export |

## For AI Agents

### Working In This Directory
- This slice is currently UI-forward; per the README, full create/delete data flow is not yet wired. When adding actions, follow the standard server-action pattern (see `@/features/announcements/actions/create.ts`).
- Capabilities: creating posts/comments needs `post.create` / `comment.create` (granted via Tags like `grad-master`, `grad-phd`, `advisor`); `ADMIN` only holds `post.delete_any` / `comment.delete_any` (moderation), not creation.
- Post creation is rate-limited per tag (`grad-master` 5/day, `grad-phd` 10/day, `advisor` unlimited) — use `checkRateLimit(userId, "post.create")`.
- Filter `deletedAt: null` for posts and comments (soft delete).

### Testing Requirements
- Rate-limit selection is covered in `tests/rate-limits.test.ts`. Run `npm run verify`.

## Dependencies

### Internal
- `@/shared/lib/session`, `@/shared/lib/authorization`, `@/shared/lib/rate-limits`, `@/shared/lib/prisma`, `@/shared/components/markdown-editor` + `markdown-renderer`.

### External
- Prisma, React, `react-markdown`.

<!-- MANUAL: -->
