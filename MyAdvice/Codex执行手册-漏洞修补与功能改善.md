<!-- 生成日期: 2026-06-25 | 来源: MyAdvice/意见和建议.md 的技术化转写 | 面向执行者: Codex -->

> ⚠️ **本手册已废弃（DEPRECATED · 2026-06-25）。** 其 T-1~T-9 功能任务经代码核实**已全部实现**（年级/毕业/草稿/导师/审计导出/画布等，见新手册 §1.5 状态台账）。
> 后续执行请改用唯一权威源 **[`Codex执行手册-全量加固-2026-06-25.md`](./Codex执行手册-全量加固-2026-06-25.md)**，它在架构再审阅基础上聚焦仍未解决的安全/完整性/架构/产品/可访问性加固项。
> 本文件仅作需求与历史溯源保留，**不要再据此执行**。

# Codex 执行手册 — 漏洞修补与功能改善

> 本文档由《意见和建议.md》转写而来，面向 **Codex 自动执行**。原文是口语化反馈，本文把每一条拆成可执行的工程任务。
> 原 `MyAdvice/意见和建议.md` 保留不动，仅作需求溯源。

---

## 第 0 章 · 总则（执行前必读）

### 0.1 技术栈与不变量
- 栈：Next.js 15 App Router + React 19 + Prisma 6 / PostgreSQL + NextAuth 5(beta) + Zod + exceljs + Tailwind。
- 路径别名：`@/*` → `src/*`。
- **架构不变量（禁止破坏）**：
  1. `ADMIN` 是治理角色，**不能创作内容**（帖子/项目）。能力由 Tag 叠加到 `MEMBER`。不要给 ADMIN 加创作权。
  2. 所有授权在**服务端**执行：`requireActiveUser()` → Zod 解析 → `assertPermissionWithAudit`（或 project 变体）→ 可选 `checkRateLimit` → `prisma.$transaction`（写实体 + 扇出通知 + 写 `AuditLog`）。
  3. 项目级权限**必须**带 `projectId` 校验（用 `assertProjectPermissionWithAudit` / `getProjectPermissions`），禁止跨项目串权。
  4. 时区统一 `Asia/Shanghai`（见 `src/shared/lib/date.ts`）。

### 0.2 执行顺序
- **先做第 1 章（数据库迁移）**，因为后续多数任务依赖新字段/新表。
- 然后按 **阶段一**（第 2–8 章：漏洞 + 中小功能）逐章执行。
- 最后做 **阶段二**（第 9 章：commit tree 无限画布等大型 UI）。
- 每完成一个「任务块」（标号 `T-x.y`）就跑一次相关测试并提交一次原子 commit。

### 0.3 质量门禁（每个任务块完成后）
```bash
npm run verify   # = prisma generate + tsc --noEmit + eslint(--max-warnings=0) + node test + prisma validate
```
阶段性还要跑：
```bash
npm run build
npm audit --audit-level=moderate
```
**任何一项不过，不得进入下一个任务块。** eslint 必须 0 warning。

### 0.4 迁移规范
- 所有 schema 改动集中在第 1 章一次性完成，生成**一个**迁移：
```bash
npx prisma migrate dev --name feedback_patch_round1
```
- 改完 enum / 加新表后，务必更新 `prisma/seed.ts`（若涉及系统数据）并跑 `npm run seed` 验证不报错。

### 0.5 每个任务块的统一模板
每个 `T-x.y` 都包含：**现状**（file:line）/ **目标** / **步骤** / **验收** / **测试** / **回滚**。严格按此执行，不要自由发挥语义。

---

## 第 1 章 · 数据库迁移汇总（阶段一第一步）

文件：`prisma/schema.prisma`。一次性加入以下全部改动，再生成单个迁移。

### T-1.1 `User` 增加入学锚点
```prisma
model User {
  // ... 现有字段 ...
  grade          String?     // 保留：人类可读年级快照（如 "研2"），由计算回填
  enrollmentDate DateTime?   // 新增：年级计算锚点，默认 = 创建年份的 9-1 (Asia/Shanghai)
  // ...
}
```
- 说明：`grade` 字段已存在（schema.prisma:20），新增 `enrollmentDate`。年级**实时计算**（见 T-2.x），`grade` 仅作展示快照。

### T-1.2 `UserStatus` 增加 `GRADUATED`
```prisma
enum UserStatus {
  ACTIVE
  SUSPENDED
  GRADUATED   // 新增：毕业锁定，零权限、禁止登录
}
```
（现状 schema.prisma:54-57 只有 ACTIVE/SUSPENDED。）

### T-1.3 `Project` 增加负责导师
```prisma
model Project {
  // ...
  creatorId   String
  creator     User    @relation("ProjectCreator", fields: [creatorId], references: [id], onDelete: Restrict)
  advisorId   String?                      // 新增：负责导师（拥有 advisor 标签的 User）
  advisor     User?   @relation("ProjectAdvisor", fields: [advisorId], references: [id], onDelete: Restrict)
  // ...
  @@index([advisorId])                     // 新增索引
}
```
并在 `User` 模型补反向关系：
```prisma
model User {
  // ...
  createdProjects  Project[] @relation("ProjectCreator")
  advisedProjects  Project[] @relation("ProjectAdvisor")   // 新增
  // ...
}
```

### T-1.4 `ProgressReport` 增加提交后编辑计数
```prisma
model ProgressReport {
  // ...
  status         ReportStatus @default(DRAFT)
  submittedAt    DateTime?
  editCount      Int          @default(0)   // 新增：SUBMITTED 后的修改次数，上限 3
  // ...
}
```
（现状 schema.prisma:256-276 无 editCount。）

### T-1.5 `Post` 增加草稿状态
```prisma
model Post {
  // ...
  category  PostCategory @default(GENERAL)
  status    PostStatus   @default(PUBLISHED)   // 新增
  // ...
  @@index([status])                            // 新增索引
}

enum PostStatus {
  DRAFT
  PUBLISHED
}
```
- **数据兼容**：已有帖子迁移后默认 `PUBLISHED`，行为不变。

### T-1.6 `ProjectNode` 增加作者色
```prisma
model ProjectNode {
  // ...
  authorId    String
  author      User   @relation("NodeAuthor", fields: [authorId], references: [id], onDelete: Restrict)
  colorHex    String?  // 新增：GitLens 式作者着色；为空时前端按 authorId 计算后备色
  // ...
}
```
- 着色优先用 `colorHex`，为空则前端按 `authorId` 哈希到固定调色板（见 T-9.x）。

### T-1.7 新表 `UserPostTag`（个人帖子标签库）
```prisma
model UserPostTag {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation("UserPostTags", fields: [userId], references: [id], onDelete: Cascade)
  label     String                                  // 标签文本，如 "明日方舟"
  createdAt DateTime @default(now())

  @@unique([userId, label])                         // 同一用户不可重复
  @@index([userId])
}
```
并在 `User` 补 `postTags UserPostTag[] @relation("UserPostTags")`。
- **隔离原则**：这是“帖子标签”，与权限 `Tag`/`UserTag` 完全无关，**不得**接入权限引擎。

### T-1.8 新表 `AuditExportArchive`（审计 Excel 归档）
```prisma
model AuditExportArchive {
  id          String   @id @default(cuid())
  fileName    String                 // audit_export_YYYY-MM-DD_seqN.xlsx
  excelData   Bytes                  // Excel 二进制内容
  seqInYear   Int                    // 当年第几次导出（1,2,3,...，跨“4 次清库”轮次累加）
  rangeStart  DateTime               // 本次导出覆盖的 AuditLog createdAt 下界（含）
  rangeEnd    DateTime               // 上界（不含）
  rowCount    Int                    // 本次导出的日志条数
  exportedAt  DateTime @default(now())
  expiresAt   DateTime               // = 当年 12-31 23:59:59，用于按自然年清理
  createdAt   DateTime @default(now())

  @@index([exportedAt])
  @@index([expiresAt])
}
```

### T-1.9 新表 `AuditExportCounter`（4 次清库计数器）
```prisma
model AuditExportCounter {
  id            String   @id @default(cuid())
  year          Int      @unique          // 自然年
  exportsInYear Int      @default(0)       // 当年累计导出次数（用于 seqInYear）
  cycleCount    Int      @default(0)       // 当前 4 次轮次内计数（0..3），到 4 触发清库后归 0
  lastExportAt  DateTime?
  updatedAt     DateTime @updatedAt
  createdAt     DateTime @default(now())
}
```

### T-1 验收 / 测试 / 回滚
- 验收：`npx prisma migrate dev --name feedback_patch_round1` 成功；`npm run prisma:validate` 通过；`npm run seed` 不报错。
- 测试：`npm run typecheck` 通过（Prisma Client 类型已含新字段/新表）。
- 回滚：删除该迁移目录并 `prisma migrate reset`（仅限本地）；或新建反向迁移移除新增字段/表。

---

## 第 2 章 · 进度管理

### T-2.1 年级实时计算 + 默认锚点 9-1
**现状**：`User.grade` 是裸字符串（schema.prisma:20），无自动增长、无锚点。
**目标**：按 `enrollmentDate` 实时推算年级；默认锚点 = 创建年份 9 月 1 日（Asia/Shanghai）；admin 可改年级（反推锚点）。

**步骤**：
1. 在 `src/shared/lib/` 新建 `grade.ts`，实现纯函数（便于单测）：
   ```ts
   export type GradeTrack = "master" | "phd";
   // master: 研0,研1,研2,研3 -> 第4年起 已毕业
   // phd:    博1,博2,博3,博4,博5 -> 第5年起 已毕业
   export const GRADE_LABELS = {
     master: ["研0", "研1", "研2", "研3"],
     phd: ["博1", "博2", "博3", "博4", "博5"],
   } as const;

   /** 距锚点的完整学年数（按 Asia/Shanghai，每年 9-1 跨年级）。 */
   export function yearsSinceEnrollment(enrollment: Date, now = new Date()): number { /* 见下 */ }

   /** 计算年级标签；返回 null 表示已毕业。 */
   export function computeGrade(track: GradeTrack, enrollment: Date, now = new Date()): string | null;

   export function isGraduatedByGrade(track: GradeTrack, enrollment: Date, now = new Date()): boolean;

   /** 默认锚点：创建年份 9-1 00:00 Asia/Shanghai。 */
   export function defaultEnrollmentDate(createdAt: Date): Date;

   /** admin 手动设年级时反推锚点：使 computeGrade == 目标。 */
   export function enrollmentDateForGrade(track: GradeTrack, gradeLabel: string, now = new Date()): Date;
   ```
   - `track` 由用户的有效标签决定：含 `grad-phd` → phd；含 `grad-master` → master（同时含取 phd 优先，或按 admin 设定，文档默认 phd 优先并在注释标明）。
   - `yearsSinceEnrollment`：用现有 `Asia/Shanghai` 工具（`src/shared/lib/date.ts`）取“学年边界”，每年 9-1 之后 +1。
2. `src/features/admin/actions/create-user.ts`：创建用户时写 `enrollmentDate = defaultEnrollmentDate(now)`。
3. 新增 server action `src/features/admin/actions/update-user-grade.ts`：admin 手动改年级 → 写 `grade` 快照 + `enrollmentDate = enrollmentDateForGrade(...)`；走标准 `assertPermissionWithAudit`（`ADMIN_USER_MANAGE`）+ `AuditLog`（action `UPDATE`，entityType `User`）。
4. 展示处（用户资料、admin 用户表）用 `computeGrade(...)` 渲染，不直接信任 `grade` 裸值。

**验收**：创建用户后 `enrollmentDate` 落在创建年 9-1；过 1 个学年边界后计算年级 +1；master 第 4 年、phd 第 5 年起 `computeGrade` 返回 null（已毕业）。
**测试**：新建 `tests/grade.test.ts`，覆盖：默认锚点、跨 9-1 边界 +1、master/phd 毕业阈值、`enrollmentDateForGrade` 往返一致。
**回滚**：删除 `grade.ts` 与 `update-user-grade.ts`，展示处回退为裸 `grade`。

### T-2.2 毕业锁定（禁止登录 + 零权限 + 撤销标签）
**现状**：`requireActiveUser`（`src/shared/lib/session.ts`）只查 `status==="ACTIVE"`；`computePermissionsFromSnapshot`（`src/shared/lib/permissions.ts:110`）`if (!user || user.status !== "ACTIVE") return permissions;`；`graduated` 标签零执行力（seed）。
**目标**：年级达已毕业（或 admin 置 `GRADUATED`）→ 无法进入网站、零权限、撤销其所有 `UserTag`。

**步骤**：
1. 新增「毕业生协调」逻辑：当 `computeGrade(...) == null`（已毕业）时，把用户 `status` 置为 `GRADUATED` 并撤销其所有有效 `UserTag`（`revokedAt = now`）。放在两处触发：
   - admin 改年级 action（T-2.1 step3）中即时处理；
   - 登录后 `requireActiveUser` 旁路检查（懒触发）：若计算已毕业但 status 仍 ACTIVE，则在该请求内升级为 GRADUATED 并撤销标签，然后拒绝。
2. `requireActiveUser`：把 `status==="ACTIVE"` 之外的（含 `GRADUATED`/`SUSPENDED`）一律拒绝进入；GRADUATED 文案明确“已毕业，账号已停用”。
3. `computePermissionsFromSnapshot` 与 `computeProjectPermissionsFromSnapshot`：保持 `status !== "ACTIVE"` 即零权限（GRADUATED 自动满足）。**新增**对 `GRADUATED` 的显式注释。
4. seed 的 `graduated` 标签：保留定义但不再作为权限载体；新增一次性数据迁移脚本 `scripts/migrate-graduated-tag.ts`，把持有 `graduated` 标签的用户 `status` 改为 `GRADUATED` 并撤销其标签。
5. `update-user-status.ts` 与 `src/features/admin/components/user-table.tsx`：状态枚举/下拉增加 `GRADUATED`；置为 GRADUATED 时同时 `tokenVersion++`（吊销旧会话）并撤销全部 `UserTag`。

**验收**：GRADUATED 用户登录被拒；其 `getUserPermissions` 为空集；其所有 `UserTag` 被 revoke；中间人改 cookie 也无法访问（服务端 status 门禁）。
**测试**：扩展 `tests/permissions.test.ts` + `tests/session.test.ts`：GRADUATED 零权限、登录拒绝、标签撤销。
**回滚**：enum 保留 `GRADUATED` 无害；移除懒触发逻辑即可恢复旧行为。

### T-2.3 进度报告“提交后最多改 3 次”
**现状**：`save-report.ts:37` 在 `SUBMITTED` 后**禁止**编辑；`ProgressReport` 无 `editCount`。
**目标**：`SUBMITTED` 且仍在窗口期/补填期内，最多再保存 **3 次**；第 4 次拒绝，提示剩余次数。

**步骤**：
1. `src/features/progress/actions/save-report.ts`：
   - 当目标报告 `status === "SUBMITTED"`：改为允许，但先校验窗口（复用 `resolveProgressWriteWindow`，`src/features/progress/lib/backfill.ts`）；
   - 若 `editCount >= 3` → `throw new Error("本月报告提交后修改次数已用完（3/3）")`；
   - 否则在事务内更新内容并 `editCount: { increment: 1 }`，写 `AuditLog`（UPDATE）。
   - `DRAFT` 状态的保存**不**计入 `editCount`（只有提交后的修改才计数）。
2. `src/features/progress/components/report-form.tsx`：提交后显示“剩余修改次数：{3 - editCount}”，为 0 时禁用保存按钮。

**验收**：提交后第 1/2/3 次保存成功且计数递增；第 4 次被拒；窗口关闭后即便次数未满也拒绝（窗口校验优先）。
**测试**：扩展 `tests/progress-window.test.ts` 或新建 `tests/progress-editcount.test.ts`：editCount 边界（0→3）、超限拒绝、DRAFT 不计数。
**回滚**：恢复 `save-report.ts:37` 的禁止编辑分支；忽略 `editCount` 字段。

### T-2.4 导师不计入进度统计/导出
**现状**：`src/app/(dashboard)/progress/page.tsx` 汇总查询 `role:"MEMBER"` 并 include advisor，**未排除导师本人**；`export-excel.ts` 未过滤导师。导师标签 `advisor` 不含 `PROGRESS_REPORT_WRITE/SUBMIT`（seed），本就不该提交。
**目标**：汇总表与导出**显式排除**持有 `advisor` 有效标签的用户。

**步骤**：
1. 复用 `getEffectiveTagNames`（`src/shared/lib/permissions.ts:172`）或在查询层联表，过滤掉拥有有效 `advisor` 标签的用户。
2. `progress/page.tsx` 的成员列表查询：排除 advisor；汇总行不再为导师生成空行。
3. `export-excel.ts`：导出前同样过滤导师；保持 `EXPORT` 审计不变。

**验收**：含导师账号时，汇总表与导出 Excel 均不含该导师行；普通研究生/博士生不受影响。
**测试**：新建 `tests/progress-summary-exclude-advisor.test.ts`（对纯函数过滤逻辑做单测，避免依赖 DB）。
**回滚**：移除过滤条件。

### T-2.5 非 admin 进 admin 的平滑过场（403 贴牌页）
**现状**：admin 各页顶部 `requirePermission(...)` 抛 `PermissionDeniedError`（`src/shared/lib/permissions.ts:243`）；`(dashboard)` 无 `error.tsx` → Next.js 原生 500。
**目标**：替换为贴合网站风格的 403 过场。

**步骤**：
1. 新建 `src/app/(dashboard)/error.tsx`（Client Component，`"use client"`）：
   - 识别 `PermissionDeniedError`（按 `error.name === "PermissionDeniedError"` 或自定义错误码）→ 渲染品牌化 403：图标 + “你没有权限访问该模块” + “返回首页”按钮，使用现有 Tailwind 设计 token；
   - 其他错误回退到通用错误展示 + `reset()`。
   - 注意：服务端抛出的错误传到 Client `error.tsx` 时 `message` 在生产被脱敏，因此**改为**让 `requirePermission` 在权限不足时 `redirect("/403")` 或在 `PermissionDeniedError` 上挂可序列化的 `digest`/标记；推荐新增 `src/app/(dashboard)/403/page.tsx` 静态贴牌页并在权限失败处 `redirect("/403")`（更可靠，绕过生产脱敏）。
2. 统一改造：把 admin 页顶部“抛错”改为“无权限则 `redirect('/403')`”（保留 `auditPermissionDenied` 审计写入）。

**验收**：MEMBER 访问 `/admin/*` 看到品牌化 403，不再是 Next.js 500；审计仍记录 `PERMISSION_DENIED`。
**测试**：`tests/admin-access.test.ts` 断言无权限路径触发审计与拒绝（对 action 层做单测）。
**回滚**：删除 `error.tsx`/`403` 页，恢复抛错。

---

## 第 3 章 · 按 Tag 分类与可见性

### T-3.1 导师按 `advisorId` 看项目；他人项目不可点
**现状**：`Project` 无 `advisorId`（已在 T-1.3 加）；`src/app/(dashboard)/projects/page.tsx` 查询**全部**项目无范围过滤。
**目标**：导师只看 `advisorId == 自己` 的项目；非负责项目不可点入（服务端校验 + 前端置灰）。

**步骤**：
1. `projects/page.tsx`：按当前用户身份分流查询——
   - ADMIN：全部项目；
   - 持 `advisor` 标签者：`where: { advisorId: me.id, deletedAt: null }`（“我负责的项目”）；
   - 普通成员：仅自己 `ProjectMember` 关联的项目。
2. 项目详情 `src/app/(dashboard)/projects/[id]/page.tsx`：进入前校验可见性——非 admin 且非该项目 advisor、非成员 → `redirect('/403')`（不可点入）。
3. 列表卡片：对不可访问项目渲染为**置灰禁用**（非隐藏，符合反馈“先设定成无法点击”）。

**验收**：导师 A 看不到导师 B 负责的项目详情（直接访问 URL 也被拒）；列表只显示其负责项目。
**测试**：`tests/project-visibility.test.ts`：advisor 范围过滤、跨导师访问拒绝。
**回滚**：恢复全量查询。

### T-3.2 侧栏不可访问项置灰禁用
**现状**：`src/shared/components/layout/sidebar.tsx:19-30` 无条件渲染全部导航（含 4 个 admin 链接）。
**目标**：按权限把无权访问项**置灰 + 不可点**（保留可见，先不美化）。

**步骤**：
1. 在 `(dashboard)/layout.tsx`（服务端）计算当前用户权限集（`getUserPermissions`），把“每项所需权限 → 是否可用”映射传给 `Sidebar`。
2. `Sidebar`：无权项渲染为 `aria-disabled`、`pointer-events-none`、降低不透明度，不渲染 `<Link>`（用 `<span>`）。

**验收**：MEMBER 看到 admin 导航为灰且点不动；ADMIN 正常。
**测试**：组件渲染快照或对“权限→可用”映射函数单测。
**回滚**：恢复无条件渲染。

> 毕业锁定（年级=已毕业）见 T-2.2，已在第 2 章实现。

---

## 第 4 章 · 公告

### T-4.1 公告分页（10/页，首/上/跳/下/尾）
**现状**：`src/app/(dashboard)/announcements/page.tsx` `take:50` 单页，无分页控件。
**目标**：服务端偏移分页，每页 10 条，提供 首页/上一页/跳转指定页/下一页/末页。

**步骤**：
1. `announcements/page.tsx`：读 `searchParams.page`（默认 1），`skip=(page-1)*10`、`take=10`；并查 `count` 算总页数。
2. 新建复用分页组件 `src/shared/components/ui/pagination.tsx`：渲染 首/上/页码跳转(输入或下拉)/下/尾，基于 URL `?page=`。本组件后续供审计页（T-8.1）复用。

**验收**：公告超过 10 条出现分页；跳转/边界（第 1 页禁用“上一页”、末页禁用“下一页”）正确。
**测试**：`tests/pagination.test.ts` 对页数计算与边界函数单测。
**回滚**：恢复单页 `take:50`。

### T-4.2 公告排序：置顶 > 紧急 > 时间倒序
**现状**：`orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }]`，**缺 `isUrgent`**。
**目标**：`置顶优先 → 紧急其次 → 同类按时间倒序（后来者居上）`。

**步骤**：把 orderBy 改为：
```ts
orderBy: [{ isPinned: "desc" }, { isUrgent: "desc" }, { createdAt: "desc" }]
```
**验收**：置顶项恒在最前；非置顶中紧急在前；同组内最新在上。
**测试**：纳入 `tests/announcements.test.ts` 的排序断言（对排序比较函数单测）。
**回滚**：移除 `isUrgent` 排序键。

### T-4.3 独立发布页
**现状**：发布表单内嵌在列表页右栏（`announcement-form.tsx`）。
**目标**：独立页面 `announcements/new`。

**步骤**：
1. 新建 `src/app/(dashboard)/announcements/new/page.tsx`：服务端校验 `ANNOUNCEMENT_CREATE` 权限（无则 `redirect('/403')`），渲染 `AnnouncementForm`。
2. 列表页把内嵌表单替换为“发布公告”按钮 → 跳 `announcements/new`。
3. 复用现有 `createAnnouncement` server action，不改其权限/审计/事务结构。

**验收**：从列表点击进入独立发布页，提交成功回列表；无权用户进入被 403。
**测试**：`tests/announcements.test.ts` 覆盖 action 权限校验。
**回滚**：恢复内嵌表单。

### T-4.4 “全员”不暴露 `targetIds=[]`
**现状**：`src/features/announcements/components/target-selector.tsx:36` 直接渲染 `<Badge>targetIds=[]</Badge>`，泄漏底层结构。
**目标**：`ALL` 时显示人话（如“发送给全体成员”）。

**步骤**：把该分支 Badge 文案改为“发送给全体成员”；不改后端 `targetType=ALL` 逻辑（`create.ts:15-20` 查 `status:"ACTIVE"` 全体）。

**验收**：选择“全员”时界面显示“发送给全体成员”，无 `targetIds=[]` 字样。
**测试**：组件渲染断言（无 `targetIds` 文本）。
**回滚**：恢复原 Badge。

### T-4.5 项目目标：选项目名 → 发给组长 + 全部组员
**现状**：`create.ts:31-36` PROJECT 目标仅查 `ProjectMember`，且 UI 要求手填项目 ID（裸 ID）。
**目标**：发布者从下拉**按项目名**选择；收件人 = 该项目组长（lead）+ 全部组员。

**步骤**：
1. `target-selector.tsx`：`PROJECT` 时把“手填 ID 输入框”换成项目下拉（label=项目名，value=projectId）。项目列表由发布页服务端查后传入（按发布者可见范围：admin=全部；advisor=自己负责的）。
2. `create.ts` 的 PROJECT 收件人解析：在 `ProjectMember` 基础上，**并集**持有 `project-lead:{projectId}` 有效标签的用户（确保 lead 必达，即使未在 ProjectMember 表中）。去重。
3. 复用 T-7.1 的“自通知排除”（发布者自己不收）。

**验收**：选项目名发布后，组长与全部组员均收到通知；裸 ID 不再出现在 UI。
**测试**：`tests/announcements.test.ts`：PROJECT 收件人解析含 lead + members 且去重、排除作者。
**回滚**：恢复手填 ID + 仅 members。

---

## 第 5 章 · 项目

### T-5.1 独立创建页 + 创建时指定组长(必)/组员(可选) + 负责导师
**现状**：`create-project.ts` 把**创建者自动设为 lead**（自动建 `project-lead:{id}` 模板标签授予 creator，行 37-54）；表单 `project-form.tsx` 仅有 name/description；创建表单内嵌列表页。
**目标**：独立创建页；创建时**必须指定组长**（可非创建者），**可选**多名组员，**指定负责导师**；据此建项目并自动授予 `project-lead:{projectId}` / `project-member:{projectId}` 标签。

**步骤**：
1. 新建 `src/app/(dashboard)/projects/new/page.tsx`：服务端校验 `PROJECT_CREATE`（无则 403）；查可选用户列表（候选组长/组员）与候选导师（持 `advisor` 标签者）传入表单。
2. 扩展 `project-form.tsx`：增加 字段——`leadUserId`（必填，单选）、`memberUserIds`（可选，多选）、`advisorId`（必填或可选，按下方校验）。
3. 扩展校验器 `src/shared/lib/validators/projects.ts`：`leadUserId: z.string().min(1)`，`memberUserIds: z.array(z.string()).default([])`，`advisorId: z.string().optional()`。
4. 改 `create-project.ts`：
   - 在事务内：建 Project（含 `advisorId`），建/复用 `project-lead:{id}`、`project-member:{id}` 模板标签；
   - 给 `leadUserId` 授予 lead 标签 + 建 `ProjectMember`；
   - 给每个 `memberUserIds` 授予 member 标签 + 建 `ProjectMember`；
   - **不再**默认把 creator 设为 lead（除非 creator 就是所选 lead）；
   - 写 `AuditLog`（CREATE, Project）。
   - 复用现有 `add-member.ts` 中的标签创建逻辑，避免重复实现。
5. 列表页把内嵌创建表单替换为“创建项目”按钮 → `projects/new`。

**验收**：创建时不选组长被 Zod 拒绝；所选组长获 lead 标签，组员获 member 标签，导师写入 `advisorId`；creator 非组长时不获 lead 权限。
**测试**：`tests/create-project.test.ts`：必填 lead、members 授予、advisorId 落库、creator 不自动成 lead。
**回滚**：恢复 creator 自动 lead + 内嵌表单。

### T-5.2 Dashboard 分栏：全部项目 / 我负责的项目
**现状**：`projects/page.tsx` 无分栏。
**目标**：Tab 切换“全部项目”与“我负责的项目”（导师=`advisorId==我`；普通成员=我参与的；admin=全部 vs 我创建/负责的）。

**步骤**：用 `searchParams.tab`（`all` | `mine`）切换查询；`mine` 对导师=`advisorId:me`，对成员=`members.some.userId:me`。复用 T-3.1 的可见性范围。
**验收**：切换 Tab 列表正确变化；URL 可分享。
**测试**：纳入 `tests/project-visibility.test.ts`。
**回滚**：移除 Tab。

### T-5.3 项目卡片悬停预览（导师）
**现状**：卡片仅 `hover:border-primary`，无预览。
**目标**：有权限导师悬停卡片显示项目简要信息（名称、状态、成员数、节点数、描述摘要）。

**步骤**：`project-list.tsx` 卡片加悬停浮层（Tailwind group-hover + 绝对定位浮层，或轻量 Popover）。数据已在列表查询中（必要时补 `_count`）。仅对有权查看该项目者展示。
**验收**：悬停出现预览；移开消失；无权者不展示。
**测试**：组件渲染断言（含关键信息字段）。
**回滚**：移除浮层。

### T-5.4 归档 / 反激活 + 168h 冷却 + 倒计时
**现状**：`archive-project.ts` 要 `PROJECT_MANAGE`，**无状态校验**、**无反激活**、无冷却、无倒计时；归档后未阻止 lead/member 操作。
**目标**：
- 仅**组长**可在 `IN_PROGRESS` 时归档 → `ARCHIVED`，写 `archivedAt`；
- 归档后 lead/member 对该项目**任何写操作**被拒；
- 组长可“启用”反激活 → `IN_PROGRESS`，但**归档后 168h（24*7）内禁止**；
- 项目名旁**实时倒计时**显示距可反激活剩余时间。

**步骤**：
1. `archive-project.ts`：
   - 权限：要求调用者持该项目 `project-lead:{id}` 标签（用 `assertProjectPermissionWithAudit` + `PROJECT_MANAGE`，并额外确认是 lead）；
   - 前置校验 `status === "IN_PROGRESS"`，否则拒绝；
   - 设 `status="ARCHIVED"`, `archivedAt=now`；保留对项目标签的处理（注意：若现状会 expire 项目标签，反激活时需能恢复——见下）。
2. 新建 `src/features/projects/actions/unarchive-project.ts`：
   - 仅 lead；校验 `status==="ARCHIVED"`；
   - 校验 `now - archivedAt >= 168h`，否则 `throw new Error("归档后 7 天内不可重新启用")`；
   - 设 `status="IN_PROGRESS"`，清 `archivedAt`；恢复必要的项目成员标签；写 `AuditLog`。
3. 写操作守卫：在项目相关 server actions（建节点、加成员、归档/反激活以外的写）入口统一加“项目 ARCHIVED 则拒绝写”。建议在 `getProjectPermissions` 调用点或一个 `assertProjectWritable(projectId)` 帮助函数集中处理。
4. UI：
   - `archive-project-button.tsx`：仅 `IN_PROGRESS` 且当前用户是 lead 时显示“归档”；`ARCHIVED` 时显示“启用”（168h 内禁用且显示倒计时）。
   - `project-detail.tsx`：项目名旁加**实时倒计时**组件（Client，`setInterval` 每秒刷新，目标时间 = `archivedAt + 168h`；到点后按钮可用）。

**验收**：非 lead 不能归档；非 IN_PROGRESS 不能归档；归档后写操作被拒；168h 内反激活被拒并显示倒计时；满 168h 后可反激活恢复 IN_PROGRESS。
**测试**：`tests/project-archive.test.ts`：状态机（IN_PROGRESS→ARCHIVED→IN_PROGRESS）、lead-only、168h 冷却边界、归档后写拒绝。
**回滚**：删除 `unarchive-project.ts` 与守卫，恢复旧 `archive-project.ts`。

---

## 第 6 章 · 帖子

### T-6.1 修复全角逗号标签解析 Bug（漏洞修补）
**现状**：`src/features/posts/actions/create-post.ts:63` `.split(",")` 只切**英文逗号**；用户输入“明日方舟，明日方舟终末地，战锤40K”（全角 `，`）→ 整句变 1 个标签。
**目标**：同时支持英文 `,` 与中文 `，`（以及顺手处理多余空白）。

**步骤**：
1. 把第 63 行的拆分改为 `.split(/[,，]/)`，保留 `.map(trim).filter(Boolean)`。
2. 排查并修复**同类**位置：公告/其它 “逗号分隔输入”的解析（如 `target-selector` 手填 ID、任何 `formData.split(",")`），统一用 `/[,，]/`。建议抽 `src/shared/lib/utils.ts` 的 `splitCommaList(input: string): string[]` 复用。
3. `post-form.tsx` 占位符提示可保留“多个标签用逗号分隔（中英文逗号均可）”。

**验收**：输入全角逗号分隔得到 3 个标签；混用中英文逗号也正确切分；空段被过滤。
**测试**：`tests/posts-tags-split.test.ts` 单测 `splitCommaList`：全角、半角、混用、首尾逗号、空白。
**回滚**：改回 `.split(",")`。

### T-6.2 个人帖子标签（自建、仅自己可见可用）
**现状**：`Post.tags` 是裸 `String[]`，无个人标签库；权限 `Tag`/`UserTag` 与此无关。
**目标**：成员可创建自己的标签（存 `UserPostTag`，T-1.7），发帖时从**自己的**标签库选择/新增；他人不可见不可用。

**步骤**：
1. 新建 actions：`src/features/posts/actions/post-tags.ts`——
   - `listMyPostTags()`：`requireActiveUser` → 查 `UserPostTag where userId=me`；
   - `createMyPostTag(label)`：Zod 校验（`label: z.string().trim().min(1).max(40)`）→ upsert（`@@unique[userId,label]` 防重）→ 返回；
   - `deleteMyPostTag(id)`：仅 owner 可删。
   - 全部走标准鉴权骨架；个人标签**不接权限引擎**。
2. `post-form.tsx`：标签输入升级为“从我的标签多选 + 可现场新增”。提交时把所选 label 写入 `Post.tags`（文本快照），同时新 label 落 `UserPostTag`。
3. 保持 `postInputSchema.tags`（`validators/posts.ts`）不变（仍是 string[] 快照）。

**验收**：用户 A 新建标签仅在 A 的选择器出现；B 看不到 A 的标签库；发帖后 `Post.tags` 存文本快照。
**测试**：`tests/user-post-tags.test.ts`：唯一约束、owner 隔离、增删查。
**回滚**：移除 `post-tags.ts` 与表单多选，恢复纯文本输入。

### T-6.3 作者自编辑 / 自删帖子 + 自删评论
**现状**：帖子**无编辑** action；删除仅 `POST_DELETE_ANY`（版主，`delete-post.ts:18`）；评论删除仅 `COMMENT_DELETE_ANY`（`delete-comment.ts:17`）。无作者自操作。
**目标**：作者可编辑、删除**自己**的帖子；可删除**自己**的评论。版主 `*_DELETE_ANY` 行为保留。

**步骤**：
1. 权限常量（`src/shared/lib/permissions.ts`）新增：`POST_UPDATE_OWN`、`POST_DELETE_OWN`、`COMMENT_DELETE_OWN`，并加入 `grad-master`/`grad-phd`/`advisor` 等可发帖标签的权限集（在 seed 模板里授予），保证“能发帖者能管自己内容”。
2. 新建 `src/features/posts/actions/update-post.ts`：`requireActiveUser` → Zod（新增 `updatePostInputSchema`：postId + 可改字段）→ 校验 `post.authorId === me.id`（或持 `POST_UPDATE_ANY`，可选）→ 事务更新 + `AuditLog`(UPDATE)。
3. 改 `delete-post.ts`：允许“作者本人（`POST_DELETE_OWN` 且 authorId==me）”或“版主（`POST_DELETE_ANY`）”软删；二者都写审计。
4. 改 `delete-comment.ts`：同理允许作者本人删自己评论。
5. UI：`post-detail.tsx` / `comment-section.tsx`：对作者本人展示“编辑/删除”入口（现状仅对 `POST_DELETE_ANY` 展示，见 `posts/[id]/page.tsx:71`）。
6. 评论可对自己评论回复——现状**已允许**（无限制），无需改；仅补“自删评论”。

**验收**：作者能编辑/删自己帖子与评论；非作者非版主不能；版主仍可删任意。
**测试**：`tests/post-author-ops.test.ts`：作者自编辑/自删、越权拒绝、版主路径保留。
**回滚**：移除新权限与 own 分支。

### T-6.4 帖子草稿 + 退出自动保存
**现状**：`Post` 无 `status`（T-1.5 已加 `PostStatus`）；无草稿、无自动保存。
**目标**：发帖可存草稿（写 `DRAFT`，仅作者可见）；“发布”才转 `PUBLISHED`；退出页面时尽力自动保存草稿。

**步骤**：
1. 新建/改造 actions：
   - `saveDraft(input)`：建/更新一条 `status="DRAFT"` 的 Post（authorId==me）；草稿不进公开列表、不发通知、不计入发帖限流。
   - 改 `createPost`：区分“保存草稿”与“发布”。发布路径维持现有限流/审计/通知；草稿转发布时再走限流校验。
2. 列表与详情查询：公开列表 `where: { status: "PUBLISHED", deletedAt: null }`；作者本人可在“我的草稿”看到自己 DRAFT。
3. 退出自动保存（前端，尽力而为）：`post-form.tsx` 用 `beforeunload` + `navigator.sendBeacon`/`fetch(keepalive)` 调用 `saveDraft`，并在卸载/路由切换时触发。**明确告知**：浏览器对 `beforeunload` 异步保存有限制，非 100% 保证；同时保留“保存草稿”手动按钮作为可靠路径。
4. 校验器：新增 `draftInputSchema`（字段同帖子但都可空，至少 title 或 content 其一非空）。

**验收**：保存草稿不公开、不发通知、不计限流；发布后进入公开列表并按发布规则限流；退出时尽力保存（手动按钮必可靠）。
**测试**：`tests/post-draft.test.ts`：草稿不入公开列表、草稿→发布限流校验、作者可见自己草稿。
**回滚**：忽略 `status`，移除草稿 action 与 `beforeunload`。

### T-6.5 限流平滑提示（替换硬编码英文）
**现状**：`create-post.ts:25` `throw new Error("Post rate limit exceeded.")` → `createPostFormAction:77` 捕获 → `post-form.tsx:40` 直接显示英文。`checkRateLimit` 返回 `{ allowed, remaining }`（`rate-limits.ts`）。
**目标**：研究生/博士生超限时给平滑中文提示，并显示剩余/上限信息，而非英文报错。

**步骤**：
1. `create-post.ts`：超限时改抛带结构的错误或返回结构化结果，文案如“今天的发帖次数已达上限（{max} 篇/天），请明天再试”。把 `remaining`/`max` 传出。
2. `post-form.tsx`：以贴牌提示样式（非红色生硬报错）展示；可在表单底部常驻显示“今日剩余可发：{remaining}”。
3. 复用 `RATE_LIMITS`（grad-master=5 / grad-phd=10 / advisor=无限）展示对应上限。

**验收**：超限时显示中文友好提示与剩余次数；无“Post rate limit exceeded.”英文。
**测试**：扩展 `tests/rate-limits.test.ts`：超限返回结构含 max/remaining。
**回滚**：恢复英文 throw。

---

## 第 7 章 · 通知

### T-7.1 自通知统一：自己触发的通知不创建
**现状**：`announcements/actions/create.ts:73-100` 收件人**未排除作者**（bug）；`projects/actions/create-node.ts:35` 已用 `userId: { not: user.id }` 排除作者；`posts/actions/create-comment.ts:46` 已排除。
**目标**：统一为“自己触发的通知不创建”（与 create-node 一致）。

**步骤**：`create.ts` 扇出通知前从 `recipientIds` 过滤掉 `user.id`（作者）。复查所有 `notification.create*` 扇出点，确保一致。
**验收**：发布者不再收到自己公告的通知；他人正常收到。
**测试**：`tests/announcements.test.ts`：收件人不含作者。
**回滚**：移除过滤。

### T-7.2 通知 UI：单击已读 + 全部已读 + 单条标未读
**现状**：`PATCH /api/notifications`（`src/app/api/notifications/route.ts`）**已支持**：带 `id`→标记单条已读；不带 `id`→标记全部已读。`use-notifications.ts:13` 30s 轮询。**缺**：UI 按钮 + “标未读”接口。`notification-list.tsx` 仅展示。
**目标**：单击通知即标已读；新增“全部已读”按钮；每条加“标为未读”按钮。

**步骤**：
1. 后端：在 `route.ts` 增加“标未读”能力——扩展 `PATCH` 接受 `{ id, read: boolean }`，`read=false` 时设 `isRead=false, readAt=null`（仅限本人通知）。保持向后兼容（无 `read` 字段时按现有“标已读”语义）。
2. 新增 server actions 或复用 API：`markRead(id)`、`markAllRead()`、`markUnread(id)`，并在 react-query mutation 后 `invalidate` 通知查询。
3. `notification-list.tsx`：
   - 单击某条 → `markRead(id)`；
   - 顶部“全部已读”按钮 → `markAllRead()`；
   - 每条右侧“标为未读”按钮 → `markUnread(id)`。
   - 已读/未读视觉区分（现有 `isRead` 字段）。

**验收**：单击置已读；全部已读一键清零未读；单条可重新标未读；只能操作自己的通知。
**测试**：`tests/notifications.test.ts`：标已读（单/全）、标未读、越权（操作他人通知）拒绝。
**回滚**：移除“标未读”分支与 UI 按钮。

---

## 第 8 章 · 管理后台

### T-8.1 审计改名「操作日志记录」+ 50/页分页
**现状**：侧栏标签「审计」（`sidebar.tsx:28`）；`admin/audit/page.tsx:14` `take:100` 无分页；`audit-log-table.tsx` 渲染 4 列。
**目标**：界面名称统一为「操作日志记录」；每页 50 条 + 首/上/跳/下/尾。

**步骤**：
1. 文案：侧栏链接、页面标题、面包屑等“审计”改“操作日志记录”。
2. `audit/page.tsx`：`searchParams.page`（默认 1），`skip=(page-1)*50`、`take=50`，查 `count` 算总页数。
3. 复用 T-4.1 的 `pagination.tsx` 组件。

**验收**：页面与导航显示「操作日志记录」；分页每页 50 条，控件齐全且边界正确。
**测试**：复用 `tests/pagination.test.ts`。
**回滚**：恢复「审计」与 `take:100`。

### T-8.2 审计自动导出（cron）+ Excel 归档 + 清理
**现状**：无导出/cron；`exceljs` 已用于 `src/features/progress/actions/export-excel.ts`（可复用模式）。新表 `AuditExportArchive`、`AuditExportCounter` 已在 T-1.8/T-1.9 建好。
**目标**：每 7 天由外部 cron 调用受保护路由导出审计为 Excel，存库；累计第 4 次导出后清空“已导出区间”的 `AuditLog`；Excel 归档按自然年清理。命名 `audit_export_YYYY-MM-DD_seqN.xlsx`。

**步骤**：
1. 环境变量：新增 `CRON_SECRET`（写入 `.env.example`）。
2. 新建路由 `src/app/api/cron/audit-export/route.ts`（`POST`）：
   - 鉴权：校验 `Authorization: Bearer ${CRON_SECRET}`（或 `?token=`），不符返回 401。**不**依赖用户会话。
   - 逻辑（单事务/串行）：
     a. 取本年 `AuditExportCounter`（无则建，`exportsInYear=0,cycleCount=0`）。
     b. 计算导出区间：`rangeStart` = 上次导出的 `rangeEnd`（首次=最早日志或固定下界），`rangeEnd = now`。
     c. 用 exceljs 把 `AuditLog where createdAt ∈ [rangeStart, rangeEnd)` 写成工作簿（列：createdAt, userId, action, entityType, entityId, ipAddress, details）。
     d. `seqInYear = exportsInYear + 1`；`fileName = audit_export_${YYYY-MM-DD}_seq${seqInYear}.xlsx`；`expiresAt = 当年12-31 23:59:59 Asia/Shanghai`。
     e. 写一行 `AuditExportArchive`（excelData=buffer, rowCount, range...）。
     f. `exportsInYear++`、`cycleCount++`、`lastExportAt=now`。
     g. **若 `cycleCount === 4`**：删除 `AuditLog where createdAt < rangeEnd`（即已导出区间），然后 `cycleCount = 0`。（Excel **不删**。）
     h. **跨年/年度清理**：删除 `AuditExportArchive where expiresAt < now`（自然年到期的 Excel）。
   - 返回 `{ ok, fileName, rowCount, cycleCount }`。
3. Admin 下载：在「操作日志记录」页加“历史导出”区块，列出 `AuditExportArchive`，提供下载（新建 `src/app/api/admin/audit-export/[id]/route.ts`，校验 `ADMIN_AUDIT_VIEW`，返回 `excelData`，`Content-Disposition: attachment; filename=...`）。
4. 调度示例（写入文档附录，不在代码里跑）：
   - crontab：`0 3 */7 * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/audit-export`（“每 7 天”近似：可用 `0 3 * * 0`（每周日）替代更稳定，文档注明两种）。
   - 或在 `ecosystem.config.js` 旁加一个 PM2 cron 进程示例。

**验收**：带正确 secret 调用成功生成归档行与正确 `seqInYear`/`fileName`；第 4 次调用后旧 `AuditLog` 被清且 `cycleCount` 归 0、Excel 仍在；过期 Excel 被年度清理；admin 可下载历史 Excel；无 secret 返回 401。
**测试**：`tests/audit-export.test.ts`：把导出/计数/清库逻辑抽成可注入 `prisma`/`now` 的纯函数单测——seq 累加、第 4 次清库、年度清 Excel、区间连续无重叠/漏档。
**回滚**：删除 cron 路由与下载路由；保留空表无害。

### T-8.3 实体 ID（cuid）说明 —— 保留不改
**现状**：全部 16 个模型 `@id @default(cuid())`（如 User=schema:11 … 逐个已确认）。
**结论（回答反馈疑问）**：`cmqkokp...` 是 **cuid**（自动随机生成，非顺序）。**建议保留**，理由：
- 不可枚举 → 防 IDOR / 资源扫描（顺序自增可被遍历 `/projects/1,2,3`）；
- 不泄漏数据规模；分布式生成无需 DB 往返；URL 安全。
**动作**：**不改 schema**。可选优化：在 admin 列表对用户展示“短码”（取 cuid 末 6 位）仅作显示，不改存储与外键。
**测试**：无（纯说明 + 可选显示改动做渲染断言）。
**回滚**：无。

### T-8.4 Tag 创建/删除权限收口（admin 不建/删项目组标签）
**现状**：`project-lead:{id}` / `project-member:{id}` 在 `create-project.ts:37` / `add-member.ts:51` 自动创建（`isSystem`）；admin tag UI 仅列 GLOBAL（`admin/tags/page.tsx:58`）；`grant-tag.ts:30` 用 `assertAnyTagPermission([ADMIN_TAG_MANAGE, TAG_APPROVE])`；无“创建任意 tag”端点。
**目标**：项目组长/组员标签**只能**经“创建项目/加成员”流程自动产生（T-5.1 已收口），admin/导师不可手动创建或删除这类项目标签；项目名即标签语义来源。

**步骤**：
1. `grant-tag.ts` / `revoke-tag.ts`：增加守卫——若目标 tag 名匹配 `^project-(lead|member):` 则**拒绝**手动 grant/revoke（这类标签生命周期由项目流程管理）。
2. admin tags 页：明确仅展示/管理 GLOBAL 系统标签；对项目标签标注“由项目流程自动管理，不可手动增删”。
3. 确认创建项目入口（T-5.1）对 admin 与 advisor 都可用且一致（admin 作为治理者可创建项目并指定 lead/members/advisor，但仍不获内容创作权——创建项目属治理动作，符合不变量）。

**验收**：手动对 `project-lead:*`/`project-member:*` grant/revoke 被拒；项目标签只随项目流程产生/消失。
**测试**：`tests/tag-guard.test.ts`：手动操作项目标签被拒；GLOBAL 标签正常。
**回滚**：移除守卫。

---

## 第 9 章（阶段二）· 项目 commit tree 无限画布

> **阶段二**：在阶段一全部完成、`npm run verify` 全绿后再做。本章是较大 UI 工程。

### T-9.1 引入 React Flow，渲染节点为无限画布
**现状**：`timeline.tsx` 仅按 depth 缩进的扁平列表；`node-card.tsx` 按 `nodeType` 着色。`ProjectNode` 有 `parentId` 树、`authorId`、（T-1.6 新增）`colorHex`。
**目标**：commit tree 改为类 GoodNotes/Xmind 的**无限画布**（平移/缩放/拖拽），用 **React Flow（@xyflow/react）**。

**步骤**：
1. 依赖：`npm i @xyflow/react`（确认与 React 19 兼容版本；锁定版本写入 package.json）。
2. 新建 `src/features/projects/components/node-canvas.tsx`（`"use client"`）：
   - 把 `ProjectNode[]` 映射为 React Flow `nodes`（id, position, data）+ `edges`（source=parentId, target=id）；
   - 自动布局：用简单分层布局（按 depth 计算 y，兄弟节点排 x）或引入 `dagre` 做树布局；
   - 启用 `panOnDrag`、`zoomOnScroll`、`fitView`。
3. 详情页 `projects/[id]/page.tsx`：用 `NodeCanvas` 替换/并存 `Timeline`（建议加“列表/画布”切换）。

**验收**：节点以画布呈现，可平移缩放；父子以连线表达；大项目不卡顿（基本量级）。
**测试**：画布映射函数（ProjectNode→nodes/edges）单测 `tests/node-canvas-map.test.ts`；UI 交互人工冒烟（`.omx/reports` 截图）。
**回滚**：保留 `Timeline`，移除画布与依赖。

### T-9.2 GitLens 式作者着色
**目标**：每个作者的节点用不同颜色，直观看出谁改的。
**步骤**：
1. 着色来源：优先 `ProjectNode.colorHex`；为空则前端按 `authorId` 哈希到固定调色板（稳定、可复现）。新建 `src/features/projects/lib/author-color.ts`：`colorForAuthor(authorId: string): string`。
2. 画布节点与 `node-card.tsx` 均使用该色（边框/角标），并加作者图例（author → 颜色）。
**验收**：同一作者节点同色；不同作者不同色；图例正确。
**测试**：`colorForAuthor` 确定性单测（同输入同输出、分布合理）。
**回滚**：回退按 `nodeType` 着色。

### T-9.3 组长不可删/改节点
**现状**：无 edit/delete 节点 action。
**目标**：项目**组长不能删除/编辑节点**（节点由作者维护；lead 仅管理项目，不改他人节点记录，保证 commit 历史不可被 lead 篡改）。

**步骤**：
1. 若按 T-6.3 思路实现节点编辑/删除：新建 `edit-node.ts` / `delete-node.ts`——允许**作者本人**（authorId==me）操作，**显式拒绝**仅凭 lead 身份的操作（即使持 `project-lead` 标签）。
2. UI：对 lead 不展示节点的编辑/删除入口；对作者本人展示。
**验收**：lead 无法删/改他人节点（服务端拒绝 + 前端无入口）；作者可管理自己节点。
**测试**：`tests/node-author-ops.test.ts`：lead 越权拒绝、作者本人允许。
**回滚**：移除 edit/delete-node。

---

## 附录 A · 命令与配置速查

```bash
# 迁移（第 1 章后）
npx prisma migrate dev --name feedback_patch_round1

# 质量门禁（每个任务块后）
npm run verify
npm run build
npm audit --audit-level=moderate

# 端到端冒烟（需本地 DB + dev server）
npm run e2e:fixtures
npm run e2e:smoke
npm run e2e:browser   # 截图写入 .omx/reports/
```

审计导出 cron（二选一，写入运维配置而非代码）：
```bash
# A) 每周日 03:00（推荐，稳定）
0 3 * * 0 curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/audit-export
# B) 近似“每 7 天”
0 3 */7 * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/audit-export
```

## 附录 B · 命名与语义约定
- 审计导出 Excel：`audit_export_YYYY-MM-DD_seqN.xlsx`（`seqN`=当年累计第几次导出，跨“4 次清库”轮次累加至年底；自然年滚动归零）。
- 年级：master `研0..研3`（第 4 年起已毕业）；phd `博1..博5`（第 5 年起已毕业）；锚点默认创建年 9-1，admin 可改。
- 归档冷却：`168h = 24*7`；倒计时目标 = `archivedAt + 168h`。

## 附录 C · 全局回滚策略
- 每个 `T-x.y` 独立 commit，便于 `git revert` 单点回滚。
- schema 变更集中于一个迁移，回滚 = 反向迁移或本地 `prisma migrate reset`。
- 新增字段均带默认值/可空，旧数据兼容（`Post.status` 默认 PUBLISHED、`editCount` 默认 0、`enrollmentDate` 可空并惰性回填）。

## 附录 D · 执行完成的总验收清单
- [ ] 第 1 章迁移成功，`prisma:validate` + `seed` 通过。
- [ ] 阶段一（第 2–8 章）每个 `T-x.y` 验收通过、对应测试新增/扩展并全绿。
- [ ] `npm run verify` 全绿（含 eslint 0 warning）、`npm run build` 通过、`npm audit` 无中危及以上。
- [ ] 关键不变量回归：项目级权限带 projectId、ADMIN 不获内容创作权、GRADUATED 用户零访问。
- [ ] 阶段二（第 9 章）画布/着色/节点权限按需完成或单独排期。
