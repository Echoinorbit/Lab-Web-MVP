# 给 Codex 的执行方案 · 第三版（提交图谱 / 进度栏 / 评论）

> 本方案由一个 3 人只读调查小组（**未改动任何代码**）对照 `MyAdvice/意见和建议第三版.md` 的三块诉求，逐文件探查 `lab-platform` 代码后写成。
> 目的：**交给 Codex 自主思考、排查并实现**。给出的是「现象 + 已定位根因（带 file:line） + 修复方向 + 验证」，不是逐行代码——请结合实际代码二次确认后自行决定最优实现。
> 涉及三大块：**A 提交图谱重做**、**B 进度栏保存/提交报错**、**C 评论楼中楼**。建议按 B → C → A 的顺序提交（B 是一行修复的硬 Bug，C 中等，A 体量最大且偏 UI 设计）。

---

## 0. 总体工作约定（务必先读）

1. **自主思考，以代码为准**。若发现本方案某处判断有误，按代码实际情况修复，并在 commit 说明里指出与本方案的出入。
2. **可以清空数据库重新测试**：用户已授权 `npx prisma migrate reset --force` + `npm run seed`。测试数据见 `prisma/seed.ts`。
3. **验证闸门**：每完成一组修改，至少 `npm run typecheck && npm run lint`；涉及逻辑跑 `npm test`；schema 改动跑 `npm run prisma:validate`。完整闸门：`npm run verify`（= typecheck + lint + test + prisma:validate）。
4. **不要破坏既有权限模型**：权限是「角色 `ROLE_PERMISSIONS` + 标签 `Tag/TagTemplate.permissions`（可带 `projectId` 作项目作用域）」双层叠加，核心在 `src/shared/lib/permissions.ts` 与 `authorization.ts`。节点编辑权限走 `src/features/projects/lib/node-author-ops.ts`，评论权限走 `src/features/posts/lib/author-ops.ts`。
5. **Git 提交（用户的明确要求）**：
   - 分批**原子提交**，每块功能单独成批；
   - **commit message 一律用中文**，每条写清「做了什么（对应第几块） + 根因 + 改了哪些文件」；先写好合适的 comment / commit 说明，再 `git commit`；
   - 每条提交结尾保留：
     `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
   - schema 改动的批次：先 `prisma migrate dev` 生成迁移文件并一并提交，再视需要 `migrate reset` 重 seed 验证。

---

## A. 提交图谱（Commit Graph）重做

> 对应第三版第 1～3 段。目标：参考 **VSCode 的 Git Graph**，把现在「表格化、分列」的提交视图改造成「**单一画布**、按作者分泳道、连线连续」的提交图，并修掉父节点排序 Bug、删除列表视图、统一权限文案与默认父节点逻辑。

### 架构速览（改前必读）

- 视图入口：`src/features/projects/components/project-node-views.tsx` —— 顶部有「提交图 / 列表」两个切换按钮（`type ProjectNodeView = "graph" | "list"`，默认 `"graph"`）。
- 图视图：`commit-graph-view.tsx` —— 当前是三大列网格 `[156px_minmax(0,1fr)_320px]`（作者 | 中部 | 节点详情），中部又是子网格 `[auto_minmax(0,1fr)_88px]`（图谱 | 提交消息 | 日期）。SVG 轨道在 `CommitGraphRail`（**逐行 58px 一张小 SVG**，并非整张画布）。
- 列表视图：`timeline.tsx` + `node-card.tsx`。
- 布局算法：`src/features/projects/lib/node-canvas.ts`（`mapProjectNodesToCanvas` / `placeSubtree`）。
- 图行数据：`src/features/projects/lib/commit-graph.ts`。
- 作者泳道/配色：`src/features/projects/lib/author-color.ts`（`buildAuthorLegend`）。
- 新建/编辑节点：`actions/create-node.ts`、`actions/edit-node.ts`；父节点校验 `lib/node-parent-guard.ts`；作者权限 `lib/node-author-ops.ts`。
- 模型：`prisma/schema.prisma` 的 `ProjectNode`（自引用 `parentId`、`authorId`、`createdAt`）。

### A1 · 🟡 左侧改为「作者」单列

- **现象/根因（确认）**：表头 `commit-graph-view.tsx:212` 写死 `分支 / 作者`，但 `buildAuthorLegend`（`author-color.ts:37-48`）实际只按 `authorId` 聚合，**根本没有分支概念**——文案误导。
- **修复方向**：项目只有一个 main 分支，去掉「分支」语义。表头改为「作者」；左列继续按作者渲染泳道（保留每位作者的配色圆点 + 姓名）。无需数据改动。

### A2 · 🟢 中部「图谱 + 提交消息」合并为「提交详情」单一画布

- **现象/根因（确认）**：`commit-graph-view.tsx:210-219` 把「图谱 / 提交消息 / 日期」拆成并排格子；`CommitGraphRail`（`:49-87`）的 `<svg>` 是**逐行独立**的小画布（每行 height≈58），跨行连线在不同 SVG 里画，无法形成 VSCode 那样连续的整张图。
- **修复方向**：
  1. 把中部改成**一张覆盖所有行的连续 SVG 画布**（高度 = 行数 × 行距），泳道竖线、父子贝塞尔连线、节点圆点全部画在这**一张** SVG 上；提交消息（标题 + 描述 + 日期）作为画布右侧的覆盖层 / 绝对定位行，与对应节点圆点垂直对齐。
  2. 列头从「图谱｜提交消息｜日期」合并为单一「**提交详情**」区域；不再用表格分隔线把每行切成格子（去掉 cell 边框，呈现整图观感）。
  3. 视觉对标 VSCode Git Graph：每位作者一条彩色泳道、连线随父子关系连续延伸、当前选中节点高亮，右侧仍可保留 `CommitInspector` 详情面板。
- **提示**：这是本块最大的一项，属 UI 工程。建议先产出一版「单画布」结构草案（可参考 `@xyflow/react` 已在依赖中，或继续用手写 SVG 但改为整图坐标系），再实现。

### A3 · 🟡 权限文案修正（仅文案，枚举逻辑已对）

- **现象/根因（确认）**：`commit-graph-view.tsx:181` 文案为
  `「节点由作者维护；项目组长不能修改他人节点。」`
- **修复方向**：改为
  `「节点由作者维护；项目组中其它成员不能修改他人节点。」`
- **实际权限校验已正确，无需改逻辑**：`node-author-ops.ts:7-19` 的 `resolveProjectNodeAuthorAccess` 是「仅作者本人可改」（`userId === authorId` 才 `allowed`），服务端 `edit-node.ts:24-34`、`delete-node.ts:23-33` 均据此抛 `ProjectNodeAuthorError`；UI 层 `node-canvas.tsx:42`、`node-card.tsx:42`、`commit-graph-view.tsx:150` 也都按 `viewerId === authorId` 隐藏操作。**只改文案即可**（确认没有遗留的 `isProjectLead` 之类未用参数引起误解）。

### A4 · 🟢 新建节点默认父节点 = 最新的「上一个人上传的节点」

- **现象/根因（确认）**：`create-node.ts:27-43` 中父节点是**可选**、完全取自用户输入（`if (data.parentId)` 才校验，`:38 parentId: data.parentId` 原样写入，可能为 `undefined`）；`node-parent-guard.ts` 只在给了父节点时校验合法性，**没有任何「自动选父」逻辑**。
- **修复方向**：当用户未显式指定父节点时，默认父节点取**该项目中最近一次提交的节点**（按 `createdAt` 倒序的第一个，即「上一个人/上一次上传的节点」），作为表单默认值或服务端兜底。
  - 建议在新建表单（`project-node-form.tsx`）打开时预填「最新节点」为默认父，用户可改；
  - 服务端 `create-node.ts` 同步兜底：未传 `parentId` 时回填为项目最新节点 id（注意并发：用与现有一致的事务/查询拿到最新节点）。
  - 注意首个节点（项目空）时父节点应为空（root）。

### A5 · 🔴 父节点恒显示在最顶端的 Bug

- **现象/根因（确认）**：`node-canvas.ts:36-69` 的 `placeSubtree` 用**树深度**定位：`positions.set(node.id, { x, y: depth * verticalGap })`，所有 root（`:47` `!parentId` 或孤儿）都从 `depth=0` 即 `y=0` 开始（`:66-69`）。因此**父节点（深度浅者）永远在顶部**，与 `commit-graph.ts:17-21` 按 `createdAt` 倒序的预期不一致——「按时间排序」被「按树深度定位」覆盖了。
- **修复方向**：把布局从「按树深度」改为「**按时间顺序的行索引**」定位（DAG 而非纯树）：
  1. 先对节点按 `createdAt`（建议**最新在上**或**最新在下**，与 VSCode 习惯一致，二选一并保持全局一致）排成一维行序，行号 = `y` 坐标；
  2. `x`（泳道）按作者分配；父子之间用连线连接，而非用深度决定纵向位置；
  3. 保证「父节点出现在其子节点之前/之后」遵循时间，而不是恒定置顶。
- **验证**：构造「父节点较早、子节点较晚」与多作者交叉的数据，确认提交图的纵向顺序严格反映时间线，父节点不再被强行顶到最上。

### A6 · 🟡 删除「列表」显示方式

- **现象/根因（确认）**：`project-node-views.tsx:14-77` 提供 `graph | list` 切换，列表视图由 `timeline.tsx` + `node-card.tsx` 渲染；作者图例 `project-node-views.tsx:55-72` **目前只在 list 视图显示**。
- **修复方向**：
  1. 移除视图切换 UI 与 `list` 分支，默认且唯一展示提交图；
  2. 作者图例若仍需要，**迁移到提交图视图内**（不要随 list 一起删掉导致图例消失）；
  3. 评估 `timeline.tsx` / `node-card.tsx` 是否还有其它引用，若无则一并清理（删之前 grep 确认无残留 import，避免编译错误）。

### A 块验证

- `npm run typecheck && npm run lint`；
- 手动：进入任一项目的提交图，确认①左列只显示「作者」；②图谱与消息为一张连续画布；③权限提示文案已更新；④新建节点默认父为最新节点；⑤父节点不再恒置顶、纵向顺序符合时间；⑥已无「列表」入口且图例仍可见。

---

## B. 进度栏无法保存草稿 / 提交报告（🔴 一行硬 Bug）

> 对应第三版第 4 段，报错：
> `Invalid prisma.$queryRaw() invocation: ... Failed to deserialize column of type 'void'. ...`

- **根因（确认，高置信）**：`src/features/progress/lib/report-write.ts:20-22` 用 `tx.$queryRaw` 执行
  ```sql
  SELECT pg_advisory_xact_lock(hashtextextended($lockKey, 0::bigint))
  ```
  `pg_advisory_xact_lock(...)` 返回 **`void`** 类型；`$queryRaw` 会尝试**反序列化结果列**，遇到 `void` 直接抛「Failed to deserialize column of type 'void'」。
- **影响面（确认）**：保存草稿与提交报告**两条路径都走它**：
  - 保存草稿：`save-report.ts:29` → `prisma.$transaction((tx) => writeProgressReport(tx, ...))` → `report-write.ts:30 lockProgressReportWrite` → `:20` 触发；
  - 提交：`submit-report.ts:113-128 reportFormAction` → `:120 saveAndSubmitProgressReport` → `:78-80 prisma.$transaction(...)` → `writeProgressReport` → 同上触发；`intent="save"` 分支（`:123`）等价于保存草稿路径。
  - 因此进度栏「保存草稿」「提交进度报告」全部失败。
- **修复方向**：把这条**不消费返回值**的语句从 `$queryRaw` 改为 **`$executeRaw`**（`$executeRaw` 不反序列化结果列，返回受影响行数 count，这里不用），标签模板参数插值 `$executeRaw` 同样支持：
  ```ts
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0::bigint))
  `;
  ```
  （保持咨询锁语义不变：仍在同一事务 `tx` 内、事务级 `xact` 锁，事务结束自动释放。）
- **不要误伤**：仓库内另一处 `$queryRaw` 在 `src/shared/lib/auth.ts:151-156`，它 `SELECT "loginAttempts","lockedUntil" ... FOR UPDATE`，**返回真实可反序列化列，是安全的，保持不变**。全仓仅此两处 `$queryRaw`。
- **顺带可选**：错误目前在 `report-form.tsx:72` 以灰色 `text-muted-foreground` 文案直出（来自 `submit-report.ts:125-127` 的 catch）。修好后该错误自然消失；如愿可把保存/提交失败提示改为更醒目的 `text-destructive`，便于用户分辨成功/失败（非必须）。
- **验证**：清库重 seed 后，用测试账号进入进度栏：①填写后「保存草稿」成功落库；②「提交进度报告」成功且状态变为已提交；③确认不再出现 `void` 反序列化报错；④`npm run typecheck && npm run lint && npm test`。

---

## C. 评论楼中楼（参考 bilibili / YouTube）

> 对应第三版第 5 段：发表评论、删除自己的评论、对自己的评论评论、对别人的评论评论，并可**反复递归**。
> 好消息：**后端与递归渲染基本已具备**，缺口集中在前端两个「写死的限制」和一个删除引发的显示 Bug。

### 现有能力（确认已具备）

- 模型支持任意嵌套：`schema.prisma:186-188` `parentId String?` + 自引用 `parent`/`replies`（`onDelete: Restrict`）。
- 创建支持 `parentId`：`create-comment.ts:30-45` 接收并校验 `parentId`，权限 `PERMISSIONS.COMMENT_CREATE`（`:19`）。
- 评论树构建：`src/app/(dashboard)/posts/[id]/page.tsx:22-48 buildCommentTree`（flat → tree）。
- 递归渲染：`comment-section.tsx:24-111 CommentItem` 已递归渲染 `children`（`:93-108`）。
- 删除：`delete-comment.ts:35-39` **软删除**（置 `deletedAt`）；权限 `author-ops.ts:34-46`（`COMMENT_DELETE_ANY` 管理员 / `COMMENT_DELETE_OWN` 本人，`permissions.ts:17-19`）。

### C1 · 🔴 回复入口被写死，只能回复顶级评论

- **根因（确认）**：`comment-section.tsx:42 canReply = canComment && allowReply`；顶级评论传 `allowReply={true}`（`:152`），但**递归给子评论时写死 `allowReply={false}`（`:104`）**——于是「回复」按钮只在第一层出现，回复无法被再回复，无法形成递归楼中楼。
- **修复方向**：让子评论也可回复——递归处不再写死 `false`（传 `allowReply={true}` 或直接以 `canComment` 决定）。

### C2 · 🔴 校验只允许「父为根评论」，回复无法再被回复

- **根因（确认）**：`src/features/posts/lib/comment-replies.ts:7-9 buildReplyParentWhere` 的 where 含 `parentId: null`——**要求父评论必须是根**，因此即便前端放开按钮，回复一条「回复」也会被后端判为「父不存在」。
- **修复方向**：放开 `parentId: null` 限制，允许把任意未删除的同帖评论作为父（保留 `postId` 与 `deletedAt: null` 校验，防跨帖/回复已删评论）。
- **配套：限制递归深度（强烈建议，按 bilibili/YouTube 习惯）**：B 站/油管实际是「**两级展示**」——根评论 + 其下扁平的回复列表，回复更深层时用「回复 @某人」前缀而非无限缩进。建议：**逻辑上允许无限层级**（数据照样存 `parentId`），但**展示时超过 2 层就拍平**（`pl-4` 不再继续叠加），并在回复正文前加「回复 @对方昵称」。这样既满足「反复回复的循环」，又避免无限缩进把版面挤垮。请在 `CommentItem` 渲染层做拍平，而非限制数据。

### C3 · 🔴 删除带回复的评论会导致其子回复整体消失（顺带修）

- **根因（确认）**：列表查询 `posts/[id]/page.tsx:58-59` 过滤 `deletedAt: null`，软删的父评论被排除；而 `buildCommentTree:40-41` 对有 `parentId` 的子评论执行 `byId.get(parentId)?.children?.push(...)`——父不在 `byId` 里时 `?.` 短路，子评论**既不挂到父、也不进 roots，直接从页面消失**。即「删掉一条有回复的评论，它底下的所有回复都看不见了」。
- **修复方向（对齐 bilibili/YouTube）**：删除父评论时**保留其楼层占位**，正文显示「该评论已删除」，其回复继续可见。可选实现：
  - 让查询连同已删评论一并取出（或单独取「有未删子评论的已删父评论」），在 `buildCommentTree` 里把已删父渲染为占位节点（`内容="该评论已被删除"`、不显示作者/操作、保留 `children`）；
  - 或将「孤儿回复」上挂到最近的未删祖先并加占位提示。
  - 二选一，保证**回复不丢**且语义清晰。
- **注意 `onDelete: Restrict`**：当前是软删除，不触发外键级联，OK；若后续改硬删，`Restrict` 会阻止删带回复的父评论，需另行处理（本次保持软删即可）。

### C 块验证

- `npm run typecheck && npm run lint && npm test`；
- 手动：①对帖子发表顶级评论；②回复别人的评论；③回复自己的评论；④回复「一条回复」（验证 C1+C2 递归生效）；⑤超过 2 层时展示被拍平且带「回复 @xx」；⑥删除自己的、且带回复的评论后，楼层显示「该评论已删除」而回复仍在（验证 C3）；⑦无权限用户看不到回复/删除入口。

---

## 提交批次与说明（请按此分批写中文 commit 后提交）

1. **第一批 · 修复进度栏报错（B）**：`report-write.ts` 改 `$queryRaw → $executeRaw`。
   commit 示例：`修复进度栏无法保存草稿/提交报告：pg_advisory_xact_lock 返回 void 导致 $queryRaw 反序列化失败，改用 $executeRaw（report-write.ts）`
2. **第二批 · 评论楼中楼（C）**：放开 `allowReply`、放开 `buildReplyParentWhere` 的 `parentId:null`、修删除导致回复消失、按 2 级拍平展示。
   commit 示例：`完善评论楼中楼：放开多级回复入口与父级校验、修复删除父评论致回复消失、按 B 站式两级展示（comment-section/comment-replies/posts page）`
3. **第三批 · 提交图谱重做（A）**：可再拆成「文案+左列+删列表」一提交、「默认父节点」一提交、「单画布+父节点排序 Bug」一提交。
   commit 示例：`重做项目提交图谱：合并为单画布、左列改为作者、修复父节点恒置顶、默认父取最新节点、删除列表视图并更正权限文案`

每批结束跑 `npm run verify`；A、C 不涉及 schema，无需迁移；若你在 C3 选择「连同已删评论取出」也不必改 schema。所有 commit 结尾保留：
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## 关键 file:line 速查表

| 块 | 诉求 | 文件:行 | 现状 |
|---|---|---|---|
| A1 | 左列改「作者」 | `commit-graph-view.tsx:212`；`author-color.ts:37-48` | 表头写死「分支/作者」，实际仅按作者聚合 |
| A2 | 合并单画布 | `commit-graph-view.tsx:210-219, 49-87` | 三列网格 + 逐行 58px 独立 SVG |
| A3 | 权限文案 | `commit-graph-view.tsx:181` | 「项目组长不能修改他人节点」需改字；逻辑(`node-author-ops.ts:7-19`)已对 |
| A4 | 默认父节点 | `create-node.ts:27-43`；`node-parent-guard.ts` | 父可选、无自动选父 |
| A5 | 父节点恒置顶 Bug | `node-canvas.ts:36-69`（`:56 y=depth*gap`，`:66-69 root depth=0`） | 按树深度定位，覆盖时间排序 |
| A6 | 删列表视图 | `project-node-views.tsx:14-77`；`timeline.tsx`；`node-card.tsx`；图例 `:55-72` | graph/list 切换，图例仅 list 显示 |
| B | 进度栏报错 | `report-write.ts:20-22`（安全对照 `auth.ts:151`） | `$queryRaw` 取 `void` → 反序列化失败 |
| C1 | 多级回复入口 | `comment-section.tsx:104`（对照 `:152`） | 子评论写死 `allowReply={false}` |
| C2 | 回复可再回复 | `comment-replies.ts:7-9` | `buildReplyParentWhere` 含 `parentId:null` |
| C3 | 删除致回复消失 | `posts/[id]/page.tsx:40-41, 58-59` | 软删父被过滤，子评论从树中丢失 |
