# 给 Codex 的漏洞修复执行方案（基于《我的意见和建议第四版》）

> 本方案的**测试与评估部分已由一个 5 人调查小组完成**：我们对照 `MyAdvice/我的意见和建议第四版.md` 的 21 条意见，逐一只读探查了 `lab-platform` 现有代码，定位了问题与根因（精确到文件:行号）。
>
> **现在交给你（Codex）的任务：根据下面的定位去修复代码。** 每条给出「现象 → 我们已定位的根因/现状 → 修复方向 → 验证」，给的是方向而非逐行代码——请结合实际代码二次确认后自行决定最优实现。
>
> 📌 **本版已并入用户的补充决策**，凡标 **✅ 用户已定** 的为用户拍板、按此执行、不要再当开放问题纠结；其余「💭 决策点」仍可由你头脑风暴权衡。

---

## 0. 总体工作约定（务必先读）

1. **自主思考、以代码为准。** 本文每条「现状/根因」都来自只读调查，可能有遗漏或判断偏差。**若你发现与代码实际不符，按代码实际修复，并在 commit 说明里指出与本文档的出入。** 鼓励你头脑风暴更优方案——下面每条结尾的「💭 决策点」是邀请你权衡的开放问题；但标 **✅ 用户已定** 的需求是硬约束，请直接落实。
2. **先分辨「真 bug」与「认知/数据偏差」再动手。** 有几条（#3、#4、#5、#7、#10、#13）调查后判断**代码可能本就正确**，用户的感受源于默认值/写窗口/数据/文案。这类**不要盲目改业务逻辑**，应先复现确认，再决定是「改默认值/文案/UI 提示」还是「确属无需改动、只在报告里说明」。
3. **验证闸门。** 每完成一组修改至少 `npm run typecheck && npm run lint`；涉及逻辑跑 `npm test`；schema 改动跑 `npm run prisma:validate`。完整闸门：`npm run verify`（当前基线：21 测试通过、0 lint warning、类型通过、schema 通过——不要让它变红）。
4. **Git 提交。** 分批原子提交，**commit message 用中文**，每条写清「修了第几条 + 根因 + 改了哪些文件」。结尾保留：
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
5. **不要破坏既有权限模型。** 权限 = 角色 `ROLE_PERMISSIONS` + 标签 `Tag.permissions`（可带 `projectId` 作项目作用域）双层叠加，核心在 `src/shared/lib/permissions.ts` 与 `authorization.ts`。改权限务必同步更新种子数据与相关 UI/测试。
6. **时间一律以北京时间（`Asia/Shanghai`）为准**（见第 16 条与 `src/shared/lib/date.ts`）。

### 架构速览
- **权限**：`permissions.ts` 定义权限常量；`computePermissionsFromSnapshot`（全局）与 `computeProjectPermissionsFromSnapshot`（按 `projectId`）聚合。`ROLE_PERMISSIONS.ADMIN` 写死管理员权限，`MEMBER` 几乎只靠标签授予。
- **标签**：`Tag`（带 `permissions` JSON、`scope=GLOBAL|PROJECT`、可挂 `TagTemplate`），用户经 `UserTag`（可带 `projectId`/`expiresAt`/`revokedAt`）持有；系统标签名见 `system-tags.ts`。
- **项目可见性**：`src/features/projects/lib/visibility.ts`。
- **用户状态**：`User.status = ACTIVE | SUSPENDED | GRADUATED`。
- **测试**：`tests/` 约 31 文件纯单元、无 DB；种子账号 `admin / ChangeMe123!`。

---

## 第一批 · 确认的功能缺失 / Bug（优先修）

### 🔴 #6 评论回复提交后不收起表单
- **现象**：帖子回复提交后，回复输入框和按钮应消失，下次点「回复」再出现。
- **已定位**：`src/features/posts/components/comment-section.tsx`——`CommentItem` 的「回复」按钮 `setIsReplying(v=>!v)`（:75），表单按 `isReplying` 条件渲染（:78-99）。**提交成功后表单仍展开、`replyContent` 不清空**，`create-comment.ts` 返回 `{ok:true}` 但客户端无自动收起。
- **修复方向**：提交成功后将 `isReplying` 置 false 并清空 `replyContent`；楼中楼多级回复保持一致行为；建议提交成功后刷新评论树让新回复即时可见。失败（网络/权限）时保留表单内容。纯前端，无需迁移。
- **验证**：发一级评论与楼中楼回复，提交后表单均自动消失、内容清空，再点「回复」重新出现。
- **💭 决策点**：成功后立即隐藏，还是先给一个短暂的「已提交」提示再隐藏？

### 🔴 #9 通知列表无分页（应每页 5 条）
- **现象**：通知栏应 5 条一页。
- **已定位**：`src/app/(dashboard)/notifications/page.tsx:10` 一次 `take:100`，`notification-list.tsx` 直接 `map` 全部，**无任何分页**。
- **修复方向**：实现分页，每页 5 条。建议服务端分页（`?page=` + `skip/take`），与公告列表页（`ANNOUNCEMENTS_PAGE_SIZE`）的实现风格保持一致。
- **验证**：造 > 5 条通知，确认每页 5 条、翻页正确。
- **💭 决策点**：传统翻页还是无限滚动？是否顺带加「已读/未读/按类型」筛选？

### 🔴 #8 研究生/博士生在总览 hover 项目看不到简报
- **现象**：除导师外，研究生/博士生在总览页 hover 项目也应看到项目简报。
- **✅ 用户已定**：**学生只能看到自己负责/参与项目的简报**（即仅其作为 `ProjectMember` 的项目），**不是**所有项目。
- **已定位**：`src/features/projects/components/project-list.tsx:41-60` 仅当 `project.canPreview` 才渲染 hover 简报；`page.tsx:29` 用 `hasGlobalAdvisorTag(...)` 决定——**只有持全局 advisor 标签者**能看。
- **修复方向**：把 `canPreview` 从「仅 advisor」改为「**该 viewer 是该项目成员**」也放行（advisor/admin 维持可见）。即按「逐项目」判断而非全局开关：学生 hover 自己参与的项目卡片能看简报，非参与项目仍隐藏。注意 Dashboard 与项目列表页两处的 `canPreview` 来源都要覆盖。
- **验证**：用研究生/博士生账号——hover **自己参与**的项目能看到简报，hover **未参与**的项目看不到。
- **💭 决策点**：「参与」是否含项目组长 `leadUserId`（应含）？是否复用现有 `visibility.ts` 的成员判定避免重复逻辑？

### 🔴 #12 用户管理界面 TAG 用逗号拼接，应改独立 Badge
- **现象**：admin 用户管理界面 TAG 应一个个框分别包装，而非逗号分隔。
- **已定位**：`src/features/admin/components/user-table.tsx:140` `row.tags.join(", ")`；同表 role/status（:137-138）已用 `<Badge>`。
- **修复方向**：每个 tag 包一个 `<Badge>`，与 role/status 列风格统一；优先显示 `displayName`（中文）而非 `name`（slug）；项目作用域标签可标注 `@项目`。
- **验证**：用户表 tag 列显示为独立中文徽章。
- **💭 决策点**：这同时关联第 11 条导入说明——标签命名/中文化是否要统一收口一份「slug→中文」映射？

### 🔴 #11 导入成员无 Excel 格式说明与模板
- **现象**：admin 导入成员时应给出 Excel 表格形式说明与示例。
- **已定位**：`src/features/admin/components/excel-import.tsx` 仅上传按钮 + 结果摘要；解析按**列顺序** username/displayName/password/studentId/grade（`actions/import-users.ts:49-56`）；无说明、无模板。
- **修复方向**：在上传区上方加列定义说明（每列含义、必填/选填、示例值）；提供可下载样例模板（或在页面内展示一张示例表格）。注意密码策略不得含学号——若 studentId 留空，校验逻辑要兼容。
- **验证**：导入页能看到清晰的列说明与示例；用示例模板导入成功。

### 🔴 #14 姓名/用户名/学号创建后不可改
- **现象**：希望能修改姓名/用户名/学号。
- **✅ 用户已定**：
  - **只有 admin 能改**用户名(`username`)、姓名(`displayName`)（以及学号 `studentId`）；**普通用户一律不能自改**（防止用户权限过大）。→ 个人中心这三项保持只读，**不要**给用户加自改入口。
  - admin 用户管理界面**新增**「改 `username` / `displayName`（/`studentId`）」的功能。
  - 相关联：**导师和 admin 这类用户本身不需要「选择导师(advisor)」**——在用户创建/编辑表单里，当目标用户是导师或 admin 时，应隐藏/免填 advisor 选择项（与 #18 创建项目时的导师选择是两回事，别混淆）。
- **已定位**：个人中心 `src/app/(dashboard)/profile/page.tsx:57-60` 三项只读、无编辑表单；admin 有 role/advisor/grade/status 更新 action，**缺** displayName/username/studentId 更新 action。
- **修复方向**：仅在 admin 用户管理新增更新 `displayName`/`username`/`studentId` 的 server action + UI；注意 username/studentId 唯一性冲突（Prisma `P2002`）翻译成可读中文错误。改 username 需评估对既有登录会话的影响（必要时递增 `tokenVersion`）。个人中心维持只读。
- **验证**：普通用户在个人中心看不到这三项的编辑入口；admin 改某用户 username/displayName 生效，重复值给出中文报错；目标用户为导师/admin 时表单不要求选导师。

### 🔴 #20 项目名称/简介无人能编辑
- **现象**：项目组长和负责导师应能更改项目名称和简介。
- **已定位**：`src/features/projects/components/project-detail.tsx:53,59` 名称/简介**仅展示**；详情页没传编辑权限；**不存在 `update-project` action**，也没有 `PROJECT_UPDATE` 权限或编辑 UI。schema 中 name/description 并非不可变。
- **修复方向**：新增项目信息编辑能力——新增/复用权限（见决策点），新增 `update-project` server action（用 `assertProjectPermission` 校验），UI 加编辑入口；授予项目组长与负责导师。
- **验证**：组长/负责导师能改名称简介并持久化；无权限者看不到入口。
- **💭 决策点**：新增 `PROJECT_UPDATE` 还是复用 `PROJECT_MANAGE`？编辑形态用 inline / modal / 独立页？是否记 `auditLog`？编辑权限是否也给创建者？

---

## 第二批 · 项目生命周期与权限重构（体量较大，先设计后实现）

### 🔴 #15 删除/恢复权限分层（admin 硬删、导师软删、admin 恢复）
- **现象**：admin 能硬删所有项目；导师能软删自己负责的项目（admin 可恢复）；admin 是硬删。
- **已定位**：当前软删用 `status='ARCHIVED' + archivedAt`（`actions/archive-project.ts`），schema 的 `deletedAt`（`prisma/schema.prisma:213`）**从未使用**；archive/unarchive **仅项目组长**（`PROJECT_MANAGE`）可做，unarchive 有 7 天冷却（`lib/archive.ts`）；**没有硬删、没有 `PROJECT_DELETE` 权限**。与用户设想几乎完全不符。
- **修复方向**（建议先出方案再写）：
  1. `permissions.ts` 新增 `PROJECT_DELETE`（硬删）等权限；理清「归档/软删/硬删/恢复」四类操作的权限归属。
  2. 导师可软删自己负责的项目（软删 = `deletedAt` 或沿用 `ARCHIVED`，二选一并消除重复语义）。
  3. admin 可恢复被软删项目，admin 可硬删（物理删或不可恢复标记）。
  4. 同步更新可见性查询、种子数据、相关测试。
- **验证**：导师软删自己项目→admin 能恢复；admin 硬删后不可恢复；组长权限边界符合新模型。
- **💭 决策点**：软删（ARCHIVED）与硬删（`deletedAt`/物理删）并存还是统一？7 天冷却对 admin 是否豁免？恢复权限是否与删除权限解耦？`deletedAt` 这个废弃字段是启用还是删除？

### 🔴 #18 admin 代导师创建项目时被强制设为自己
- **现象**：admin 应能代替导师创建项目，且负责导师填实际导师名，而非把 admin 自己当导师。
- **✅ 用户已定**：**admin 不会携带 advisor 标签**；admin 代创建项目时**只能从导师列表里选择其他导师**作负责导师（绝不会把 admin 自己设成 advisor）。
- **已定位**：`actions/create-project.ts:36` `advisorId = creatorIsAdvisor ? user.id : data.advisorId`——创建者若有 advisor 标签则**强制设为自己并忽略表单**；`project-form.tsx:66-72` 前端 disable 并 hidden input 锁值。
- **修复方向**：保留「导师本人创建 → 负责导师=自己」分支；admin 创建走「从导师列表选取负责导师」分支（因 admin 无 advisor 标签，`creatorIsAdvisor` 为 false，天然进入 `data.advisorId` 路径——确认此路径正确开放且后端校验所选导师持有效 advisor 标签即可）。
- **验证**：admin 选某导师为负责导师创建项目成功，advisorId 为所选导师而非 admin；导师本人创建仍自动绑定自己。

### 🔴 #19 组员选择：原生 multiselect，且无「按导师筛选学生」
- **现象**：组员应一个个添加（现状像只能单选的列表）；设想先选导师，再选其名下学生。
- **✅ 用户已定**：交互用**树形**。在创建页**先选一位导师 → 在本页（不跳转）就地展开一个「该导师的学生树(student tree)」面板**，从树里逐个勾选其名下学生加入。
- **已定位**：创建时 `project-form.tsx:56-62` 用原生 `<select multiple>`（体验差、无分组），候选为所有 `role=MEMBER` 活跃用户；创建后 `project-member-form.tsx:36-44` 单选逐个加；`User.advisorId`（`schema.prisma:22`）存在但**未用于组员 UI**。
- **修复方向**：用 `User.advisorId` 建「导师 → 名下学生」映射；UI 改为：选导师后在当前页内联渲染该导师的学生树（可多选勾选，无整页跳转），逐个加入组员；创建后 `project-member-form` 尽量与之统一交互。
- **验证**：创建项目时选某导师→就地出现其学生树→勾选多名学生加入；切换导师树内容随之刷新；全程不跳转页面。
- **💭 决策点**：树的层级如何组织（导师→学生两层即可，还是按年级再分组）？没有导师的学生如何归类？创建后增删成员是否复用同一树组件？

### 🟡 #21 总览「年级/姓名/学号/导师」框对导师无用
- **现象**：导师总览那个含年级/姓名/学号/导师的框是干什么的？对导师无用可删。
- **已定位**：它是进度报告摘要表 `ProgressSummaryTable`（`src/features/progress/components/summary-table.tsx`，数据见 `page.tsx:66-87`）：普通用户只看自己，admin/`PROGRESS_REPORT_READ_ALL` 看全部；**关键**用 `withoutEffectiveAdvisorTagWhere()` 把**导师自己排除**（page.tsx:10,31）——所以导师看它几乎是空表，自然觉得没用。
- **修复方向**（取决于产品定位，见决策点）：要么**让导师看到自己名下学生的进度**（去掉对导师的排除、按 advisor 关联过滤），要么**仅在 admin 视角渲染并改名**为「学生进度管理」，对导师隐藏。不要简单删功能（admin 在用）。
- **验证**：按确定的定位，导师视角下该框要么有用（显示其学生进度）要么不再出现。
- **💭 决策点**：目标受众是 admin 全局监控 / 导师看自己学生 / 学生自查？为何当初排除 advisor 用户？是否要按导师分组筛选、补充最后编辑时间/截止日期等？

### 🔴 #17 admin 接收所有通知（与本批一起做）
- **现象**：admin 应能收到所有通知以便管理。
- **已定位**：`src/features/announcements/actions/create.ts:26-28` `targetType="ALL"` 时取所有 ACTIVE 用户（admin 同等对待）；**不存在「admin 自动纳入所有通知」逻辑**——定向通知（仅某标签/某项目）时 admin 收不到。
- **修复方向**：在通知收件人生成处（announcements `recipients`、以及 POST_COMMENT/TAG_GRANTED 等其它通知来源）让 admin（或具管理权限者）自动纳入；注意去重（`notifications/lib/recipients.ts`）。
- **验证**：发一条仅定向某标签/某项目的通知，admin 也能收到。
- **💭 决策点**：admin「收到一切」可能造成通知淹没——是无差别全收，还是给 admin 一个独立的「管理员视角/可过滤」收件箱？哪些通知类型需要纳入 admin？

---

## 第三批 · 提交图谱体验（UI 增强）

### 🟡 #1 选中作者只高亮其第一个节点（应高亮全部）
- **现象**：选某作者时应高亮他的所有节点。
- **已定位**：`src/features/projects/components/commit-graph-view.tsx`——点作者泳道按钮只 `find` 第一条节点（:277）`setSelectedId(firstRow.id)`，画布按 `row.id===selectedId` 只高亮单点（:125-134）；作者按钮无选中态。
- **修复方向**：新增「选中作者」状态，画布把该作者**所有**节点高亮（或淡出其他作者节点）；作者按钮显示选中态；与「选中单个节点」共存或互斥要想清楚。
- **验证**：点作者→其全部节点高亮，按钮有选中反馈，可清除/切换。
- **💭 决策点**：改节点圆圈样式还是加遮罩层？再次点击取消还是另设清除按钮？选中后是否自动滚动到该作者节点？

### 🟡 #2 三列宽度固定，应可拖拽
- **现象**：作者/提交详情/节点详情三列边界应能拖拽调节（否则 commit tree 太小）。
- **已定位**：`commit-graph-view.tsx:262-315` 列宽是 Tailwind 固定网格 `lg:grid-cols-[156px_minmax(0,1fr)_320px]`（:263,:268），**无拖拽分隔条**；SVG 画布 `absolute inset-0` 占满中间列。
- **修复方向**：加可拖拽分隔条（react-resizable-panels 或手写 pointer 拖拽），让用户调节列宽，给中间画布更大空间；建议宽度持久化到 `localStorage`。
- **验证**：拖动分隔条列宽实时变化，画布跟随变大，刷新后保留。
- **💭 决策点**：用库还是手写？哪几列可调？移动端（`lg:` 隐藏第三列）改抽屉/弹窗还是维持隐藏？要不要「最大化画布」预设？

---

## 第四批 · 需先复现确认、可能并非代码缺陷（谨慎处理）

> 以下几条调查后判断**代码可能本就正确**，请先复现确认真因，再决定改默认值/文案/UI，**避免误改正确逻辑**。

### ⚪ #7 公告条数：总览 5 条 / 列表 10 条 —— 大概率无需改，先验证
- **✅ 用户已定**：期望就是**总览页公告 5 条、其它（公告列表页）10 条**——这与当前实现一致。
- **已定位**：总览页 `src/app/(dashboard)/page.tsx:47-52` 已 `take:5` ✅；公告列表页 `announcements/page.tsx` `ANNOUNCEMENTS_PAGE_SIZE = 10` ✅。
- **该做什么**：**先验证、原则上不改代码**。按用户建议**造满 15 条公告**实测：总览只显示最近 5 条、公告列表页每页 10 条且分页正确。若实测与「5/10」预期相符，则在报告里标「无需改动」；仅当发现偏差（如总览不是最新 5 条、列表分页错乱）才修。

### ⚪ #3 「进度提交后就不能保存」——疑似设计，非 bug
- **调查结论**：提交后实际**仍可保存最多 3 次**（`lib/edit-count.ts` `MAX_SUBMITTED_REPORT_EDITS=3`，`report-form.tsx:46` `canSave`），只是**不能再次提交**（提交按钮 `isSubmitted` 后永久禁用，:77）。提交要求 `status==="DRAFT"`（`submit-report.ts:88`），用 `pg_advisory_xact_lock`。
- **该做什么**：先复现确认用户卡在哪一步。若确为「额度用尽 / 文案误导」，则**改 UI 文案与状态提示**（如显示「剩余可修改次数」「已提交，不可再次提交」「提交时间/最后保存时间」），而非改写锁逻辑。若产品要求「提交后完全只读」，再调整额度。
- **💭 决策点**：提交后该完全只读还是保留 3 次额度？额度用尽时禁用按钮的文案如何改？

### ⚪ #4 「只能填当月」——疑似默认值+写窗口造成的错觉
- **调查结论**：其实**有上一月/下一月导航**（`progress/page.tsx:79,85`，`?year=&month=` 切换）。但默认月份**写死** `DEFAULT_YEAR=2026 / DEFAULT_MONTH=6`（:9-10）；另有 25-27 日（上海时间）写窗口（`date.ts` 的 `isProgressReportWindowOpen`/`canWriteProgressReport`）。
- **该做什么**：① 把 `DEFAULT_MONTH/YEAR` 改为**动态当前月**（经上海时区换算，不要写死 2026-6）；② 考虑加月份选择器（下拉/日历）而非只有前/后按钮；③ 明确区分「可浏览任意月」与「仅 25-27 可编辑」，在 UI 上标注当前月的写窗口状态。**不要把写窗口逻辑当成 bug 删掉。**
- **💭 决策点**：真正约束是「只能编辑当月」还是「只能在 25-27 编辑任意月」？需要月份选择器吗？

### ⚪ #5 「删除搜索功能」——搜索当前不存在
- **调查结论**：帖子页 `posts/page.tsx` 直接 `take:50`，**全仓库没有搜索 UI/接口/路由**。
- **该做什么**：先与需求确认用户指的是不是别的控件（某筛选/排序被当成「搜索」）。**若确实没有搜索，则无需改动**，在报告里说明；若用户其实是想**要**搜索，再按需新建（这与「删除」相反，务必先澄清）。

### ⚪ #10 「graduated 还能否进站」——已被阻止，符合期望
- **调查结论**：`auth.ts:223-226` 登录检查 `status!=="ACTIVE"` 即拒，`session.ts:24-29` 仅 ACTIVE 通过，GRADUATED 重定向 `/login?reason=graduated`。**已阻止 ✅**。
- **该做什么（小修）**：① 审计日志把 graduated 也记成原因 `"suspended"`，建议区分原因便于排查；② 确认 `?reason=graduated` 在登录页有对应中文提示文案，没有则补；③ 注意区分「graduated **标签**」与「GRADUATED **状态**」——确认两者不会脱节（有标签但状态仍 ACTIVE 仍能登录）。

### ⚪ #13 「suspended 与 graduated 的区别」——确有差异，主要是解释清楚
- **调查结论**：SUSPENDED 可逆、不撤销标签、递增 tokenVersion；GRADUATED 不可逆、走毕业流程、**撤销所有有效标签**（`graduation.ts:62`）、也递增 tokenVersion。两者都阻止登录。
- **该做什么**：代码语义本身成立。可做的小改进：毕业前给「将撤销所有标签」二次确认；admin 下拉里 GRADUATED 选项（`user-table.tsx:67`）防误点；核对两次递增 tokenVersion 的顺序安全。

### 🔴 #16 时区：核心机制正确，但「操作日志时间与实际时间对不上」是确认 bug
- **现象**：时间以北京时间为准。**用户复核补充：操作日志（审计/操作记录）显示的时间和实际时间对不上。**
- **调查结论**：`src/shared/lib/date.ts` 已统一用 `Asia/Shanghai`（`getShanghaiDateParts` 等），DB 存 UTC，进度窗口/学年/审计导出都走上海时区，`tests/progress-window.test.ts` 通过。**核心机制正确**，但**前端展示分散**：多处各自 `date.toISOString().slice(0,10)`（如 `progress/page.tsx`、`announcements/page.tsx`、**`admin/audit/page.tsx`**、`comment-tree.ts`、`commit-graph-view.tsx`、`node-canvas.tsx`）。其中**审计/操作日志页很可能直接显示 UTC 的 ISO 串**，相对北京时间差 8 小时——这就是「时间对不上」的根因。
- **修复方向**：① **重点修操作日志/审计日志页的时间显示**，改为按 `Asia/Shanghai` 格式化（含日期+时分），核对与服务器实际操作时刻一致；② **抽一个统一的「北京时间格式化」函数**收口所有展示，替换散落的裸 `toISOString().slice(...)`；③ grep 排查所有裸 `new Date()`/`toLocaleString`（无 timeZone 参数）受运行环境时区影响的点；`formatNodeDate()` 对入参格式的隐含假设也要核实。
- **验证**：执行一次会写审计日志的操作（如改用户状态/导入），日志页显示的时间 = 北京时间的实际操作时刻（不再差 8 小时）；其它页面日期展示同样为北京时间。

---

## 建议提交批次
1. **第一批（功能缺失/Bug）**：#6、#9、#8、#12、#11、#14、#20。
2. **第二批（项目生命周期与权限）**：#15、#18、#19、#21、#17（体量大，先设计后实现）。
3. **第三批（图谱体验）**：#1、#2。
4. **第四批（先复现/验证再定夺）**：#7（造 15 条公告验证，多半不改）、#3、#4、#5、#10、#13；**#16 的「操作日志时间对不上」是确认 bug，应实修**（其余时区项为加固）。

每批结束跑 `npm run verify`；涉及 schema 的批次先 `prisma migrate dev` 生成迁移，再视需要 `migrate reset` 重 seed 验证。

## 验证总览
- `npm run typecheck` / `npm run lint` / `npm test` / `npm run prisma:validate`（或一次性 `npm run verify`）。
- 手动冒烟：`npm run dev` 后用 MEMBER（无 grad 标签）、grad 学生、导师、admin 四类账号验证发帖、评论回复收起、项目可见性/创建/编辑/删除、组员树选择、通知与公告分页（造 15 条公告）、进度填报、操作日志时间；必要时 `npm run e2e:smoke`（只读）。
- 数据相关项（#3/#4/#7/#10/#16）务必在 `migrate reset` + `seed` 后复测，分清「代码问题」与「数据/默认值问题」。

---

## 附录 · 21 条 → 批次 / 关键文件速查

| # | 意见摘要 | 批次 | 关键文件 |
|---|---------|------|---------|
| 6 | 回复后收起表单 | 1 | `comment-section.tsx:75,78-99` |
| 9 | 通知每页5条 | 1 | `notifications/page.tsx:10`（无分页） |
| 8 | 学生看**自己参与**项目的简报 | 1 | `project-list.tsx:41-60`，`page.tsx:29`，`visibility.ts` |
| 12 | tag用独立框 | 1 | `user-table.tsx:140` |
| 11 | 导入Excel说明 | 1 | `excel-import.tsx`，`import-users.ts:49-56` |
| 14 | **仅admin**可改姓名/用户名/学号 | 1 | `profile/page.tsx:57-60`(保持只读)，`admin/actions/*`(新增) |
| 20 | 组长/导师改名称简介 | 1 | `project-detail.tsx:53,59`，缺 `update-project` |
| 15 | 删除分层 | 2 | `archive-project.ts`，`unarchive-project.ts`，`schema.prisma:213` |
| 18 | admin代导师创建(只选他人) | 2 | `create-project.ts:36`，`project-form.tsx:66-72` |
| 19 | 组员**树形**(先选导师→学生树) | 2 | `project-form.tsx:56-62`，`project-member-form.tsx:36-44`，`schema.prisma:22(advisorId)` |
| 21 | 总览年级框用途 | 2 | `progress/components/summary-table.tsx`，`page.tsx:66-87` |
| 17 | admin收所有通知 | 2 | `announcements/actions/create.ts:26-28` |
| 1 | 选作者高亮所有节点 | 3 | `commit-graph-view.tsx:277,125-134` |
| 2 | 三列可拖拽 | 3 | `commit-graph-view.tsx:262-315` |
| 7 | 公告 总览5/列表10(验证) | 4(先验证) | `page.tsx:47-52`，`announcements/page.tsx`(PAGE_SIZE=10) |
| 3 | 提交后不能保存 | 4(先复现) | `submit-report.ts:88`，`report-form.tsx:46,77`，`edit-count.ts` |
| 4 | 只能填当月 | 4(先复现) | `progress/page.tsx:9-10,79-87`，`date.ts` |
| 5 | 删搜索 | 4(先澄清) | `posts/page.tsx`（无搜索） |
| 10 | graduated不能进 | 4(已满足) | `auth.ts:223-226`，`session.ts:24-29` |
| 13 | suspended vs graduated | 4(已满足) | `user-status.ts`，`graduation.ts:62` |
| 16 | 北京时间+**操作日志时间bug** | 4(日志实修) | `admin/audit/page.tsx`，`shared/lib/date.ts` |
