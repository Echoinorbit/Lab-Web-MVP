# 给 Codex 的网站架构排查与修复操作指南

> 本指南由一个 5 人调查小组（只读，未改动任何代码）对照 `MyAdvice/意见和建议第二版.md` 的 19 条问题逐一探查 `lab-platform` 代码后写成。
> 目的：**交给 Codex 自主思考、排查并修复**。给出的是「现象 + 已定位根因 + 修复方向 + 验证」，不是逐行代码——请结合实际代码二次确认后自行决定最优实现。

---

## 0. 总体工作约定（务必先读）

1. **自主思考**：以代码为准。若发现本指南某处判断有误，按代码实际情况修复，并在 commit 说明里指出与指南的出入。
2. **可以清空数据库重新测试**：用户已授权执行 `npx prisma migrate reset --force` + `npm run seed` 重建测试数据（部分问题如 #7、#16-18 疑似数据问题而非代码问题）。测试数据见 `prisma/seed.ts`，测试用户「王明远」等在其中。
3. **验证闸门**：每完成一组修改，至少 `npm run typecheck && npm run lint`；涉及逻辑跑 `npm test`；schema 改动跑 `npm run prisma:validate`。完整闸门：`npm run verify`。
4. **Git 提交**：分批原子提交，**commit message 一律用中文**，每条说明「修复了什么问题（对应第几条）+ 根因 + 改了哪些文件」。提交结尾保留：
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
5. **不要破坏既有权限模型**：权限是「角色 `ROLE_PERMISSIONS` + 标签 `Tag.permissions/TagTemplate.permissions`（可带 `projectId` 作项目作用域）」双层叠加，核心在 `src/shared/lib/permissions.ts` 与 `authorization.ts`。改权限务必同步更新种子数据与相关 UI。

---

## 1. 架构速览（修复前必读）

- **权限**：`permissions.ts` 定义 32 个权限常量；`computePermissionsFromSnapshot`（全局）与 `computeProjectPermissionsFromSnapshot`（按 `projectId`）分别聚合。`ADMIN` 权限写死在 `ROLE_PERMISSIONS.ADMIN`，`MEMBER` 几乎只有 `TAG_REQUEST`，其余靠标签授予。
- **项目可见性**：`src/features/projects/lib/visibility.ts` 决定「全部 / 我的」两个 tab 的查询条件。
- **标签**：`Tag`（可挂 `TagTemplate`、带 `permissions` JSON、`scope=GLOBAL|PROJECT`），用户通过 `UserTag`（可带 `projectId`、`expiresAt`、`revokedAt`）持有。系统标签名见 `src/shared/lib/system-tags.ts`（如 `ADVISOR_TAG_NAME`）。
- **限流**：`src/shared/lib/rate-limits.ts`，按标签配额，键名如 `post.create`。
- **帖子标签**：`Post.tags` 是 `String[]`（随帖快照）；另有 `UserPostTag` 表按用户持久化标签备选项。

---

## 2. 问题清单（按优先级与依赖排序）

> 标注：🔴 确认的 Bug ／ 🟡 边界·语义问题 ／ 🟢 功能增强。

### A 批 · 关键 Bug（第一批提交）

#### 🔴 #4 草稿保存后无法发布帖子（多个根因叠加，请逐一排查）
> 这是本次最易踩坑的 bug，「显式 保存草稿→发布 按钮」路径本身能跑通，但仍有多条独立链路导致发布失败/静默失败。请逐一确认，可能需要全部修。
- **根因 1 · 限流拒绝（高置信）**：`rate-limits.ts:13-19` 中 `post.create` 只为 `grad-master`/`grad-phd`/`advisor` 三类标签配了配额。`getRateLimitSelection` 遍历用户标签求 `maxAllowed`，**若用户不持有这三类标签则 `maxAllowed=0 → kind:"denied" → allowed:false`**。而 `saveDraft`（`actions/save-draft.ts`）**不走限流**，`createPost`（`actions/create-post.ts:31`）**走限流**——于是「能存草稿、不能发布」。**修**：拥有 `POST_CREATE` 但无匹配限流标签时回退为合理默认（基础配额或 `unlimited`），让限流标签集合与「谁拥有 `POST_CREATE`」对齐。
- **根因 2 · 自动存草稿的 id 永不回写表单**：`post-form.tsx:93-99` autosave 用 `void fetch(...).catch()` 丢弃响应，`/api/posts/drafts/route.ts:6-7` 虽返回 `{id}` 但客户端不读；卸载/`beforeunload`（`post-form.tsx:108-115`）静默建 DRAFT 但 `draftIdRef` 仍空。用户回到 `/posts` 表单全新（`postId=""`），再点发布→`createPost`（`create-post.ts:36`）因无 `postId` 改为**新建一篇 PUBLISHED**，原自动草稿永远留 DRAFT 发不出，且产生重复草稿。**修**：autosave 读取返回 `id` 回写 `draftIdRef`。
- **根因 3 · 草稿校验比发布宽松**：`draftInputSchema`（`validators/posts.ts:14-25`）`title` 无最小长度；`publishPostInputSchema`（:3-12）`title.min(2)/content.min(1)`。保存了短标题草稿点发布→ZodError 被 `catch`（`create-post.ts:152-159`）返回 `ok:false`，message 是 Zod JSON 串，**发布失败且报错不可读**。**修**：统一/友好化发布校验，区分并翻译 ZodError 提示。
- **根因 4 · UX 死路**：草稿卡片（`post-list.tsx:19`）链到只读 `/posts/{id}`，详情页对草稿只读、发布入口藏在 `/edit` 且需 `POST_UPDATE_OWN`，用户看不到发布按钮。**修**：草稿卡片直链 `edit` 或详情页加发布按钮。
- **附**：复核 `update-post.ts` 的 `updatePost` **从不设置 `status`**——若允许从草稿直接发布，需保证走 `createPost`（置 `PUBLISHED`）而非 `updatePost`（保持 `DRAFT`）。
- **验证**：用仅有内容作者标签、无 grad/advisor 标签的用户：存草稿→发布应成功；短标题草稿发布应得可读中文校验提示；autosave 后再发布不应产生重复 DRAFT；已达配额用户应得中文限流提示而非静默失败。

#### 🔴 #7 导师作为项目组员却看不到/无法参与项目（标签冲突）
- **根因（确认）**：`visibility.ts:31` `getProjectVisibilityWhere` 与 `:43` `getMyProjectWhere`，对持**全局 advisor 标签**的用户直接 `return { advisorId: viewer.id }` **短路**，永不执行 `members: { some: { userId } }`。因此「王明远」作为导师同时是某项目 `ProjectMember` 时，列表只显示他**作为负责导师**的项目，查不到他**作为组员参与**的项目。（详情页 `canViewProject:47-51` 是 fall-through，故直链反而能打开——解释了「时隐时现」。）
- **修复方向**：把 advisor 分支从「替换」改为「并集」——可见项目 = `advisorId=我` **OR** `members.some(userId=我)`（admin 仍全可见）。三个函数（含 `canViewProject`）保持一致。
- **验证**：seed 一个 advisor 同时为另一项目组员，确认「全部」「我的」两 tab 都能看到两类项目。

#### 🔴 #13 / #19 管理员无法创建项目、无法创建用户
- **#13 根因（确认）**：`PROJECT_CREATE` 只通过 advisor 标签授予，`ROLE_PERMISSIONS.ADMIN`（`permissions.ts:52-70`）**不含** `PROJECT_CREATE` → admin 无法创建项目。**修复**：给 `ROLE_PERMISSIONS.ADMIN` 增加 `PROJECT_CREATE`（及必要的 `PROJECT_MANAGE`）。产品要求：admin 创建项目时**负责导师必须从导师列表中选取**，不可把 admin 自己绑为 advisor（现有「负责导师=创建者」逻辑只适用于导师创建，`create-project.ts` 处理需分流）。
- **#19 根因（高置信）**：创建用户失败最可能是**密码策略过严**（`src/shared/lib/security.ts:10-31`：≥10 位 + ≥3 类字符 + 不含用户名/学号），但创建表单**零提示**且报错是英文 muted 文案，用户以为「无法创建」。次因：用户名/学号重复触发 Prisma `P2002` 被泛化错误吞掉。**修复方向**：表单旁明确展示中文密码规则；把校验失败/重复冲突翻译成具体中文错误（区分「密码不符合规则」「用户名已存在」）。请实跑创建流程定位准确报错。
- **验证**：admin 创建项目（选一名导师为负责导师）成功；admin 用合规/不合规密码各创建一次用户，错误信息为可读中文。

### B 批 · 边界·语义问题（第二批提交）

#### 🟡 #11 「全部项目」没显示全部
- **定位**：`projects/page.tsx` + `visibility.ts`。非 admin 用户下，「全部」tab 与「我的」tab 返回**完全相同**的数据，所谓「全部项目」实为「我可见项目」，与用户期望（看到平台全部项目）不符，且与 #7 短路 bug 叠加。
- **修复方向**：先随 #7 修好并集逻辑；再厘清产品语义——「全部」是否应对所有登录用户展示平台全部项目（可能需要新增只读可见权限或放宽 `getProjectVisibilityWhere`）。请统一「全部 / 我负责 / 我参与」三种边界，避免再次混淆。

#### 🟡 #5 通知未显示发布人姓名
- **根因（确认）**：`Notification` 模型（`schema.prisma:299-315`）**没有 `senderId`/actor 字段**，创建通知处只写静态 `title/content`，前端无数据可显示。
- **修复方向**：给 `Notification` 增加可空 `senderId`（关联 `User`，`onDelete: SetNull`）+ 索引；所有创建通知处回填发起人；通知列表 join 并展示发起人 `displayName`。需迁移。

#### 🟡 #12 通知未显示类型
- **根因（确认）**：`NotificationType` 枚举已有 8 类（`schema.prisma:317-326`），API 已 `select` type，但渲染端 `notifications/page.tsx` 未 select、`NotificationRow` 类型缺 `type`、列表组件不展示。纯 UI 丢弃。
- **修复方向**：页面查询补 `type`，类型补字段，UI 用中文标签/图标区分（置顶公告/紧急通知/项目/标签授予等）。建议做一个 `NotificationType → 中文文案 + 颜色` 映射表。

#### 🟡 #6 无法对评论进行评论（楼中楼缺回复入口）
- **根因（确认）**：后端楼中楼**已完整**——`Comment.parentId/parent/replies`（`schema.prisma:183-185`）、`create-comment` 支持 `parentId`、`buildCommentTree` + `CommentItem` 递归渲染都在。**唯一缺陷**是前端无「回复」入口：`comment-section.tsx` 只有底部一个仅含 `postId` 的表单，`CommentItem` 无回复按钮，故永远只能发顶级评论。
- **修复方向**：在 `CommentItem` 加「回复」按钮，点开内联表单并把该评论 `id` 作为 `parentId` 提交（复用现有 `create-comment` action）。纯前端，无需迁移。

#### 🟡 #14 解释/改进 admin 标签栏的「权限」面板
- **根因（确认）**：`admin/tags/page.tsx:72` 的权限面板是**硬编码**的 `post.create + comment.create` 占位，不随所选 Tag 动态变化，也无中文释义——你看到的两个权限只是写死示例，不代表真实含义。
- **修复方向**：面板改为读取该 Tag 实际 `permissions`（或其 `TagTemplate.permissions`）动态渲染，并建立 `权限字符串 → 中文说明` 映射（32 个权限全集见 `permissions.ts:4-37`，例：`post.create`=发帖、`project.member.manage`=管理项目成员、`admin.user.manage`=管理用户）。建议把映射抽成 `permissions.ts` 旁的常量供多处复用。

#### 🟡 #15 admin 用户列表标签显示英文 slug + 删除「培养类型」
- **根因（确认）**：`admin/users/page.tsx:21-23` 查询只 `select` 了 `tag.name`（slug），未取 `displayName`，故显示冗长英文。「培养类型」并非真实 DB/表单字段，而是由 `grad-master`/`grad-phd` 标签**派生**的 `gradeTrack`，唯一文案在 `user-table.tsx:87`。
- **修复方向**：查询补 `tag.displayName` 并在表格显示中文；删除「培养类型」展示（移除 `user-table.tsx:87` 相关派生与列）。

#### 🟡 #16-18 年级体系（疑似数据问题）
- **结论（确认）**：`src/shared/lib/grade.ts` 的年级枚举**已经**与期望一致（研0–研3、博1–博5、已毕业）。代码无需改。
- **行动**：很可能是**种子/测试数据**里的 `grade` 值不规范。请清库重 seed 后核对；若 seed 数据有误则修 `prisma/seed.ts`。仅当发现实际枚举与期望不符时才改 `grade.ts`。

### D 批 · 进度栏（可随 B 批一起）

#### 🟡 #10 导师不应看到「进度」入口
- **根因（确认）**：侧边栏导航的 `progress` 项**无权限门控**（`src/shared/lib/navigation-access.ts`），对所有人可见，导师也能看到。
- **修复方向**：给 `progress` 导航项配置可见性条件（如要求 `PROGRESS_REPORT_WRITE` 或 `PROGRESS_REPORT_READ_ALL` 任一），使导师默认看不到；若导师确需「查看全部」，用读取全部权限放行。仅隐藏，不删功能。

### C 批 · 功能增强（第三批，体量较大，先设计后实现）

#### 🟢 #3 帖子标签改为「随写随发、不持久化」
- **现状**：发帖时同时维护 `Post.tags`（快照，保留）与 `UserPostTag`（按用户持久化复用项），后者与用户期望冲突。
- **修复方向**：发帖表单改为纯文本输入中英文逗号分隔标签（复用 `splitCommaList`），写入 `Post.tags` 即止；**移除/停用** `UserPostTag` 的 upsert 与「历史标签下拉」（`save-draft.ts:25-27`、`create-post.ts:32-34`、`update-post.ts:39-45`、edit/list 页的 `userPostTag.findMany`）。是否删表由你评估（可先停用再迁移删除）。

#### 🟢 #1 + #2 公告 72h 生命周期 + 公告 Dashboard 容器
- **根因（确认）**：`Announcement` 模型（`schema.prisma:117-134`）只有 `deletedAt`，**无任何过期/生命周期字段**；总览页把公告生硬平铺。
- **修复方向**：
  - 生命周期：加 `expiresAt`（或基于 `createdAt + 72h` 计算）；总览查询过滤掉过期公告（管理端可仍可见）。需迁移。
  - Dashboard 容器：把总览散落的公告收进统一的「公告中心」卡片/组件（用户建议参考 21st.dev 的 dashboard 组件）。属 UI 设计任务，先出方案再实现。

#### 🟢 #8 项目创建时的成员选择 UX + 排除创建者
- **根因（确认）**：组员选择是原生 `<select multiple>`（难多选）；`create-project.ts` 的 `creatorUserId` 参数**未被使用**，故未排除创建者；「负责导师=创建者」未实现（advisor 是独立下拉）。
- **修复方向**：做一个居中弹窗（穿梭框：上「已加入」下「未加入」，逐个添加/移除）；导师创建项目时负责导师=创建者本人并从组长/组员候选中排除创建者；admin 创建时负责导师从导师列表选取（接 #13）。

#### 🟢 #9 新增「项目负责导师」角色（project-responsible-advisor）—— 体量最大，单独成批
- **根因（确认）**：当前 `Project.advisorId` 只是展示用单一外键，**没有**对应标签/权限，也**没有**「转让组长」「踢出组员」的 server action 与权限枚举；且一个项目只能有一个 advisor，无法满足「可多个负责导师」。
- **修复方向**：
  1. `permissions.ts` 新增权限如 `PROJECT_LEAD_TRANSFER`（转让组长）、`PROJECT_MEMBER_REMOVE`（踢出组员）。
  2. 新建 `project-responsible-advisor` 的 `TagTemplate`（权限 = 项目组长全部权限 + 上述两项），通过项目作用域 `UserTag(projectId=...)` 授予，支持一个项目多个负责导师。
  3. 实现两个 server action：把某组员升为组长（原组长降为组员）、踢出组员，均用 `assertProjectPermission` 做项目作用域校验。
  4. 项目页对持有该标签者展示对应操作入口。
  5. 更新 `system-tags.ts`、`prisma/seed.ts`、`tag-grants.ts` 的标签授予逻辑。

---

## 3. 额外发现（用户未提及，建议一并评估）

- **🔴 越权/隐私（高优先，建议进 A 批）**：总览与公告列表**完全不按 `targetType/targetIds` 过滤可见性**（`page.tsx:44-49` 仅 `deletedAt:null`）。`targetType` 只在 `announcements/actions/create.ts` 用于生成通知收件人，**不限制公告展示**——于是定向公告（`USERS/PROJECT/TAG`）所有人都能在总览看到，等同全员公开。修：公告查询按 viewer 与 `targetType/targetIds` 过滤（复用 `announcements/lib/recipients.ts` 的目标判定）。
- **🟡 默认公开风险**：`Post.status` 默认 `PUBLISHED`（`schema.prisma:150`），任何遗漏显式设值的写路径都会默认公开。建议默认改 `DRAFT`。
- `update-post.ts` 的 `updatePost` 从不设置 `status`：若任何 UI 用它发布草稿会静默失败（与 #4 同源风险）。
- 通知/限流/权限三处的「标签集合」缺乏单一事实源，容易像 #4 那样错位（拥有权限却无配额）。建议收敛为一处配置。
- `post-form.tsx` 的自动存草稿在卸载时触发（`beforeunload` + cleanup），与发布跳转存在竞态，修 #4 时一并回归测试。
- 限流：`enforceRateLimit`（`rate-limits.ts:110-131`）事务内先 upsert 自增再判超限靠回滚撤销，并发有锁竞争；`checkRateLimit`（:154-182）命名像只读但**也自增计数**，需核对调用点是否误增。
- `createMyPostTag`（`post-tags.ts:19-24`）单独入口不走 tags `max(12)` 上限，可无限堆标签（按 #3 移除 `UserPostTag` 后自然消解）。

---

## 4. 建议的提交批次

1. **第一批（关键 Bug）**：#4、#7、#13、#19。
2. **第二批（边界·UI）**：#11、#5、#12、#6、#14、#15、#16-18、#10。
3. **第三批（功能增强）**：#3、#8、#1+#2，最后 #9（最大）。

每批结束跑 `npm run verify`；涉及 schema 的批次先 `prisma migrate dev` 生成迁移，再视需要 `migrate reset` 重 seed 验证。

## 5. 验证总览（端到端）

- `npm run typecheck`、`npm run lint`、`npm test`、`npm run prisma:validate`（或一次性 `npm run verify`）。
- 手动冒烟（可参考 `scripts/e2e-smoke.ts`）：分别用 MEMBER（无 grad 标签）、grad 学生、导师、admin 四类账号验证发帖/发布、项目可见性、创建项目/用户、通知展示、评论回复。
- 数据相关问题（#7、#16-18）务必在 `migrate reset` + `seed` 后复测。
