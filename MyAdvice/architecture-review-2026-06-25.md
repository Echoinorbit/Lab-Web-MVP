# 实验室协作管理平台 — 架构 / UI / 业务逻辑只读审阅

> 生成日期:2026-06-25 ·　审阅方式:**全程只读**,未修改任何源码
> 审阅维度:① UI/UX 与可访问性　② 业务逻辑与权限正确性　③ 架构一致性　④ 产品完成度与逻辑缺陷
> 方法:4 个只读分析 agent(UI/安全/架构/代码)并行深读源码,本文为综合、去重、统一分级后的结论。
> 技术栈:Next.js 15 App Router · React 19 · Prisma 6 / PostgreSQL · NextAuth 5(beta) · Zod · Tailwind

---

## 0. 总体结论

这是一个**工程纪律明显高于一般 MVP**的代码库:授权真正服务端化(客户端无任何安全门控)、Prisma 访问统一走单例、绝大多数写动作遵循一致的 `requireActiveUser → Zod → assert*WithAudit → checkRateLimit → $transaction(实体 + 通知 + 审计)` 模式、SQL 全参数化、`npm audit` 0 漏洞、`tsc --noEmit` 通过。**没有发现注入、RCE、硬编码密钥(源码内)或权限绕过类 Critical。**

风险集中在三类:

1. **完整性 / 并发缺陷**(非权限绕过,但会破坏业务不变量):限流配额、补填窗口、缺 DB 唯一约束、跨项目 parentId。
2. **"假 UI" 与可访问性**:死表单、假搜索框、登录页假数据、全站无 ARIA live region、状态仅靠颜色/英文枚举。
3. **架构债(接真实数据后会被放大)**:每请求重复查询同一用户、桶文件契约失效、三套并存的授权判定、错误消息中英混杂泄漏。

**一条重要事实更正:README 已过时。** README 自述"部分列表页用示例数据 / `/api/notifications` 返回空 / 帖子评论与项目时间线未接库"——经代码核实**这些流程均已接真实数据库**。当前**唯一真正的"前端有 UI、后端完全缺失"断点是 `admin/settings`**。

**总体裁定:COMMENT(不阻断)。** 建议优先处理下方"跨维度最高优先级"6 项。

---

## 1. 评分与统计

| 维度 | Critical | High | Medium | Low | 小结 |
|------|:---:|:---:|:---:|:---:|------|
| ① UI/UX 与可访问性 | 3 | 5 | 6 | 5 | 多处"假 UI"+ 系统性可访问性缺失 |
| ② 业务逻辑与权限(安全) | 0 | 2 | 5 | 5 | 架构稳固;风险为完整性/并发,非越权 |
| ③ 架构一致性 | 0 | 2 | 3 | — | 纪律高;债集中在数据编排与授权抽象层 |
| ④ 产品完成度与逻辑缺陷 | 0 | 1 | 3 | 4 | 仅 1 个真断点(settings);1 个 HIGH 逻辑 bug |

> 说明:跨维度重复命中的发现(如"限流配额事务外消耗")在各维度分别计数,但在第 2 节合并为单条最高优先级项。

---

## 2. 跨维度最高优先级(强烈建议先修)

以下 6 项要么被**多个独立 agent 同时命中**(高置信度),要么是**唯一真断点**。

### P0-1 ｜限流配额在事务失败后被"白白消耗",且与业务写入非原子 〔High · 三方命中:安全 + 代码 + 架构〕
- 证据:`src/shared/lib/rate-limits.ts:88-107`(先 `upsert {count: increment}` 自增,再判 `allowed: count <= max`);`src/features/posts/actions/create-post.ts:28-33`(`checkRateLimit` 在 `:28`,`$transaction` 在 `:33` 之后才开始);`src/features/announcements/actions/create.ts:97-104` 同构。
- 影响:计数器自增发生在业务事务**之外且之前**。若事务体内任一步抛错(如草稿 `Draft not found`、`buildUserPostTagUpsertArgs`),配额已扣减且**无回滚** → 用户当天名额被偷走;即便成功,扣减也与帖子创建非原子。
- 修复:把 `checkRateLimit` 的自增并入同一 `$transaction`(传 `tx`),或"先 count 判断 → 事务内成功后再 increment"。建议抽象为 `enforceRateLimit(tx, …)`,从结构上保证"check-and-consume"与其副作用同事务。

### P0-2 ｜`admin/settings` 是装饰性死表单,提交无任何效果 〔Critical(产品) · 双方命中:UI + 代码〕
- 证据:`src/features/admin/components/settings-form.tsx:7-22`(`<form>` 无 `action`/`onSubmit`/server action,"进度窗口 25-27""Session 小时数"全为硬编码 `defaultValue`),由 `src/app/(dashboard)/admin/settings/page.tsx:15` 直接渲染;全仓无 `SystemSetting` 模型。
- 影响:管理员填写并点击"保存设置"后**页面静默无反应、数据不落库**,却会以为治理参数已保存——这正是 `PRODUCT.md` 明令禁止的"静态展示 demo / 客户端隐藏的假象",验收方一眼可识破。
- 修复:补 `SystemSetting` 模型 + server action(`useActionState` 回状态);未实现前至少明确标注"此设置暂未生效"或移除该卡片。

### P0-3 ｜补填窗口"一次性"语义未被原子保证,且仅保存草稿不消耗窗口 〔High · 双方命中:安全 + 代码〕
- 证据:`src/features/progress/actions/submit-report.ts:21-41` + `src/features/progress/lib/backfill.ts:9-41`(读 `usedAt:null` 与 `markBackfillWindowUsed` 是**两条独立语句、且在事务外**);`src/features/progress/actions/save-report.ts:23-26`(校验窗口但**从不**标记 `usedAt`)。
- 影响:① 两个并发 `submitProgressReport` 可双双通过 `usedAt:null` 检查 → "一次性"窗口被多次消费(TOCTOU 竞态)。② 用户在 24h 窗口内反复"保存草稿"可无限编辑历史月报而不消耗窗口。若产品意图是"补填=单次写入机会",这是逻辑漏洞。
- 修复:check-and-consume 合并为同事务内的单条条件更新,用受影响行数判定:
  ```ts
  const consumed = await tx.progressBackfillWindow.updateMany({
    where: { id: backfillWindowId, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) throw new Error("补填窗口已使用或已过期。");
  ```
  并明确 save 是否也消耗窗口。

### P0-4 ｜每个请求对同一用户表 / Tags 重复查询 3–4 次(N+1 风格放大) 〔High(架构) · 架构命中〕
- 证据:`requireActiveUser()`(`src/shared/lib/session.ts:37`)已查 user+tags,但返回类型 `ActiveSessionUser`(`session.ts:8-13`)**丢弃了 status/tags/permissions**;于是 `assertPermissionWithAudit → getUserPermissions`(`permissions.ts:156` 再查)、`checkRateLimit → getEffectiveTags`(`permissions.ts:191` 三查)、NextAuth `session` 回调(`auth.ts:219-220`)又算一遍。`createPost` 单请求即 3 次往返。
- 影响:当前骨架/示例数据下不可见;接真实数据 + 并发后将成为 P95 抖动与连接池压力主因。
- 修复:用 React `cache()` 包裹"user + permissions + tags"的单次加载,或扩展 `requireActiveUser` 返回带权限快照的上下文(`requireActiveUserWithPermissions()`),`assert*`/`checkRateLimit` 接受已加载快照重载。

### P0-5 ｜真实 `AUTH_SECRET` 与默认 `ADMIN_PASSWORD` 落在磁盘 `.env` 〔High(安全) · 安全命中〕
- 证据:`.env:2`(`AUTH_SECRET="t/bhEN3LQ…"` 为实时 HS256 JWT 签名密钥)、`.env:5`(`ADMIN_PASSWORD="ChangeMe123!"`)。`.gitignore` 已正确忽略 `.env`(好),但密钥已明文落盘,应视为已暴露。
- 影响:任何能读到工作树的人(备份、共享开发机、误打包)即可伪造任意 `sub`/`role` 的会话 JWT。`session` 回调会用 DB 复核 `tokenVersion`/`status`,限制了伪造 token 的可用性,但仍是凭证暴露。
- 修复:立即轮换 `openssl rand -base64 32`,密钥移入部署密钥管理器而非仓库内 `.env`;轮换默认管理员密码(seed 已设 `mustChangePassword=true`,良好);建议 CI 加 gitleaks 守卫。

### P0-6 ｜全站无 ARIA live region,所有异步状态对屏幕阅读器静默 〔Critical(可访问性) · UI 命中〕
- 证据:全仓 `aria-live` / `role="alert"` / `role="status"` **零命中**;所有表单错误/成功均为普通 `<p className="text-sm text-destructive">`(如 `login-form.tsx:49`、`change-password-form.tsx:31`、`user-create-form.tsx:56`、`report-form.tsx:72`)。
- 影响:登录失败、创建成功、导入失败、提交结果等关键反馈,屏幕阅读器用户完全感知不到——直接违反 `PRODUCT.md` 的 WCAG AA 要求。
- 修复:抽象统一 `FormFeedback` 组件,error 容器加 `role="alert"`,success/info 加 `role="status" aria-live="polite"`,替换全部分散写法。

---

## 3. 维度一:UI/UX 与可访问性

> 基线:`PRODUCT.md` —— 清晰克制可信、高密度但可扫描、状态必须可解释、WCAG AA、交互状态不只依赖颜色、尊重 reduced motion、中文 copy 直接具体、拒绝"假 UI / 营销 landing / 装饰堆叠"。

### Critical
- **C1 系统设置死表单** → 见 P0-2。
- **C2 破坏性操作零确认、零撤销提示**:删除帖子 `post-moderation.tsx:34-42`、删除公告 `announcement-delete-button.tsx`、撤销 Tag `tag-grant-form.tsx:81-83`、删除节点 `project-node-actions.tsx:28-34`、删除评论 `comment-section.tsx:44-50`;业务组件中 `confirm(` 零命中。高密度后台误触即不可逆。修复:统一 `ConfirmButton`/两段式确认 + 成功 toast。
- **C3 全站无 ARIA live region** → 见 P0-6。

### High
- **H1 角色/状态/分类向用户暴露英文枚举,未本地化**:`user-table.tsx:137-139`(`ACTIVE/SUSPENDED/GRADUATED`、`ADMIN/MEMBER` 裸渲染)、`summary-table.tsx:21`(`DRAFT/SUBMITTED/MISSING`)、`project-list.tsx:27`(`IN_PROGRESS/ARCHIVED`)、`post-list.tsx:29`。`profile/page.tsx:10-13` 已有 role 中文映射但未推广。修复:统一 `STATUS/ROLE/CATEGORY_LABELS` 映射层。
- **H2 状态完全靠颜色区分**:`report-list.tsx:19`、`user-table.tsx:138`(status Badge 连颜色都没有)、`node-card.tsx:51-55` 作者色点 `aria-hidden` 且无文字。违反"不只依赖颜色"。修复:文案 + 图标 + 可见标签。
- **H3 通知"已读"用 `opacity-75` 表达**:`notification-list.tsx:79,85`,会把本已 `muted` 的正文进一步压低对比度,或跌破 4.5:1。修复:改用未读圆点 + 文字徽章,正文保持全对比度。
- **H4 移动端导航抽屉缺可访问性**:`mobile-nav.tsx:17-21`,`<div onClick>` 无 `role="dialog"`/`aria-modal`、无 Esc、无焦点陷阱、无关闭按钮。修复:规范 dialog 模式。
- **H5 Header 搜索框是无功能假控件**:`header.tsx:23`,无 `name`、不在 `<form>`、无逻辑,占据顶部最显眼位置。修复:接真实搜索或移除/禁用并标注。

### Medium
- **M1 登录页右侧大面积假数据面板**:`login/page.tsx:16-63`(硬编码"张三 86% / 待审 Tag 3 / DICOM 阻塞"),违反 anti-references。
- **M2 治理 `<select>` 缺关联 label 且 onChange 即触发服务端写**:`user-table.tsx:59-107`(改 ADMIN 一选即生效,无确认、无 `aria-label`)。
- **M3 错误反馈 tone 不一致**:部分把"错误"渲染成中性灰 `text-muted-foreground`(`user-create-form.tsx:56`、`tag-grant-form.tsx:70,84`、`report-form.tsx:72`),与红色 `text-destructive`(`login-form.tsx:49`)混用。可参考 `post-form.tsx:122-125` 的 tone 分流抽象成通用组件。
- **M4 全站无 reduced-motion 处理**:`prefers-reduced-motion` 零命中;`archive-project-button.tsx:26` 每秒 setState 倒计时也无降级。修复:`globals.css` 加 `@media (prefers-reduced-motion: reduce)`。
- **M5 DataTable 与 audit 表无空状态**:`data-table.tsx:22-32` 空数据时只剩孤立表头;对比 `notification-list.tsx:108-112` 有空态,标准不统一。修复:`emptyLabel` 跨列空行。
- **M6 无加载/骨架状态**:dashboard 各 `page.tsx` 为 async server component 但无 `loading.tsx`;首页 7 个并发 prisma 查询(`page.tsx:31-76`)慢时首屏空白。

### Low
- **L1** `badge.tsx:8-9` 默认无底色,高密度表格中视觉强调弱。
- **L2** `pagination.tsx:71-82` 跳转越界仅靠浏览器原生约束,无文本提示(服务端已 clamp)。
- **L3** 链接型按钮缺 `focus-visible` 样式:`progress/page.tsx:79,85`、`pagination.tsx:37-41`。
- **L4** `markdown-renderer.tsx:8` table 无横向滚动兜底,宽表撑破移动端。
- **L5** 侧栏标签"操作日志记录"过长(`sidebar.tsx:29`),与 2 字标签排版不齐。

---

## 4. 维度二:业务逻辑与权限正确性(安全)

> 风险等级:MEDIUM。无 Critical/注入/越权;主导风险是磁盘明文密钥、若干竞态/事务完整性缺陷、缺 DB 唯一约束。`npm audit --omit=dev` → 0 漏洞;无 `dangerouslySetInnerHTML`、无 raw SQL。

### High
- **S1 真实 `AUTH_SECRET`/默认 `ADMIN_PASSWORD` 落盘 `.env`** → 见 P0-5。
- **S2 补填窗口消费非原子(TOCTOU)** → 见 P0-3。

### Medium
- **S3 限流计数器在 action 事务外自增、失败不回滚** → 见 P0-1。
- **S4 `createProjectNode` 未校验 `parentId` 属于同一项目(跨项目串连)**:授权已用 `assertProjectPermissionWithAudit(projectId)` 正确隔离,但 `data.parentId` 被直接写入(`create-node.ts:13-35`),schema `ProjectNode.parent`(`schema.prisma:246-248`)无同项目约束。A 项目有 `project.node.create` 的用户可传入 B 项目的 `parentId`,跨边界挂子节点、泄漏 B 节点存在性/破坏其树。`update/deleteProjectNode` 安全(先查再派生 projectId)。修复:事务内 `findFirstOrThrow({ id: parentId, projectId, deletedAt: null })`。
- **S5 缺 DB 级唯一约束,应用层去重有竞态**:`UserTag` 活跃授予、`ProgressReport(userId,year,month)` 均靠 `findFirst` 后 `create`(`grant-tag.ts:49-59`、`save-report.ts:28-63`)。并发可产生双份活跃 Tag / 同月双报告,破坏权限聚合与"每月一报"假设。修复:`@@unique([userId,year,month])` + 对活跃 `UserTag` 的部分唯一索引(`WHERE "revokedAt" IS NULL`)。
- **S6 账户锁定(`lockedUntil`)不终止已存在会话**:`auth.ts:92-98` 仅在登录 `authorize` 校验锁定,**不** bump `tokenVersion`;`requireActiveUser`/`isSessionCurrent`(`session.ts:24-69`)也不复查 `lockedUntil`。已登录用户被锁后仍可用至 24h JWT 过期。部分属设计(锁定针对登录爆破),需对照威胁模型确认。
- **S7 无安全响应头**:`next.config.ts` 仅 `reactStrictMode`/`typedRoutes`,缺 CSP / HSTS / `X-Frame-Options` / `nosniff`(`react-markdown` 默认转义 HTML,存储型 XSS 风险低)。修复:加 `headers()` 策略;审计导出下载补 `nosniff`。

### Low
- **S8** cron 审计导出接受 `?token=` 查询参数密钥(`cron/audit-export/route.ts:12-22`),易入访问日志;比较非常量时间。改为仅 Bearer + `timingSafeEqual`。
- **S9** `Tag.permissions` JSON 数组未对 `PERMISSIONS` 白名单校验(`permissions.ts:95-108`),由可信的 `admin.tag.manage` 持有者写入,非越权但缺写时校验(Zod `.refine`)。
- **S10** `change-password` catch-all 吞掉所有错误(`change-password.ts:71-82`),利于不泄漏但也屏蔽监控。
- **S11** `bcryptjs`(纯 JS)cost 12 可接受但慢、限 72 字节;新部署建议 `argon2id`。匿名用户的 dummy-hash 时间均衡(`security.ts:34-36`)是良好的反枚举。
- **S12**(已复核安全)通知 PATCH 经 `buildNotificationReadUpdate(user.id, data)` 锚定本人 `userId`,无 IDOR;若该 helper 变更需保持 `where` 始终带 `user.id`。

**确认正确的有意不变量(非缺陷):** 授权全服务端强制、项目 Tag 按路径隔离(`permissions.ts:129,147,227`)、会话吊销(suspend/改角色/改密码均 bump `tokenVersion`)、SUSPENDED/GRADUATED 零权限、SQL 全参数化、server action CSRF 由 Next.js POST+action-id+同源兜底、审计/通知与实体同事务(除 S2/S3 例外)。

---

## 5. 维度三:架构一致性

> 整体纪律高于一般 MVP:`shared/` 不反向依赖上层(已验证为空)、Prisma 单例集中、15/16 写动作模式一致、服务端事实优先真正落实(客户端 `usePermissions` 在 `.tsx` 中零安全用途调用,导航门控 `layout.tsx:20-23` 由服务端 `getUserPermissions` 计算)。

### High
- **A1 每请求重复查询同一用户/Tags(N+1 放大)** → 见 P0-4。根因:`requireActiveUser` 返回契约过窄(已查 tags 却只回身份)。
- **A2 三套并存的授权判定,且最敏感判定不进审计**:统一权限系统(`PERMISSIONS` + `assert*`)之外,细粒度归属退回裸 `throw`:`archive-project.ts:22`(`assertProjectPermissionWithAudit` 之后再 `hasEffectiveProjectLeadTag` 手判 + `throw new Error("仅项目组长可以归档项目。")`,`unarchive-project.ts:22-23` 同构);作者删除 `delete-post.ts:24`/`update-post.ts:26`/`delete-comment.ts:23` 手写 own/any;另有 `assertProjectWritable`(`writable.ts:13`)第三套。问题:(a) 同一"是否有权"概念散落三种机制,无单一模板;(b) 这些裸 `throw` **不经 `auditPermissionDenied`** → 最敏感的"非组长归档""非作者删帖"反而不进审计,与通用拒绝的审计覆盖倒挂。

### Medium
- **A3 桶文件(barrel)契约名存实亡**:`src/AGENTS.md` 要求经 `index.ts` 消费,但 `app/` 对 `features/*/lib/*` 深引 ≥19 处(`page.tsx:7` `getProjectVisibilityWhere`、`posts/page.tsx:2` drafts、`announcements/new/page.tsx:6` 跨特性深引),且无 feature 的 `index.ts` 导出其 lib。数据编排层(where 构造/可见性/排序)成了"泄漏的公共 API 却不在契约内",接真实数据后深引面积只增。修复二选一:lib 进桶 re-export,或在 `AGENTS.md` 诚实改为"组件/action 走桶,lib 可深引",并以 ESLint `no-restricted-imports` 强制(已 `--max-warnings=0`,有抓手)。
- **A4 错误处理契约不统一且泄漏内部英文消息**:仅 3 个自定义错误类,其余 30+ 裸 `Error`;form action 兜底 `error.message` 直接回显英文给中文用户(`delete-post.ts:22` `"Post not found."`、`import-users.ts:43` `"Excel file has no worksheet."`),且项目类中文/内容类英文混杂。违反 `PRODUCT.md`"避免技术错误暴露给普通成员"。修复:`AppError { code, userMessage }` 基类 + 兜底只回 `userMessage`。
- **A5 API route 与 server action 是两套并行 trust boundary,缺统一适配层**:`api/notifications/route.ts:8` 直接 `requireActiveUser()`,但其内部用 `redirect("/login")`(`session.ts:34,68`)——在 route handler 中 `redirect` 抛 `NEXT_REDIRECT`,对 fetch 客户端表现为非预期 307/异常而非干净 401 JSON。同时四个 route 四种守卫风格(内联 `requirePermission` / 零内联 / `CRON_SECRET` / 直接 `requireActiveUser`),是漂移温床。修复:`withApiAuth`/`requireApiUser`(返回 401 JSON)+ `withApiPermission` 包装器。

**根因(架构师判断):** ① `requireActiveUser` 把"已认证上下文+权限快照"降级成"仅身份",催生重复查询(A1)并迫使各 action 二次取权(A2);② 桶契约只覆盖 UI/action 两类、从未纳入 lib 数据编排层与 API route 抽象(A3、A5)。即约定停在"组件级封装",未延伸到"数据访问与授权编排层"。

---

## 6. 维度四:产品完成度与逻辑缺陷

### 流程完成度清单(以代码为准)

| 流程 | 状态 | 关键说明 |
|------|------|----------|
| admin/users | ✅ 已闭环 | 创建/导入/改角色/状态/年级/导师/吊销会话齐全且页面接入 |
| admin/tags | ✅ 已闭环 | 授予/撤销接库;仅 GLOBAL Tag 可手动管理(有 guard) |
| admin/audit | ✅ 已闭环 | 真实分页 + 历史导出列表 + 下载链路(cron 生成) |
| **admin/settings** | ⛔ **仅骨架** | **唯一真断点**:表单无 action、无持久化、无 `SystemSetting` 模型 → 见 P0-2 |
| announcements | ✅ 已闭环 | 创建/更新/删除 + ALL/USERS/PROJECT/TAG 受众解析 + 通知 fan-out |
| projects | ✅ 已闭环 | 列表/详情/创建/成员/节点 CRUD/归档/解档;详情接真实节点树与画布 |
| progress | ✅ 已闭环 | 草稿/提交/补填窗口/导出全接库;25-27 窗口与补填规则生效 |
| posts | ✅ 已闭环 | 发帖/草稿/编辑/删除、评论、限流、Tag 全流程接库 |
| notifications | ✅ 已闭环 | 页面与 `/api/notifications` GET/PATCH **均查真实表**(README 说法过时) |

### 逻辑缺陷
- **D1〔High〕限流配额事务外消耗、时机错误** → 见 P0-1。
- **D2〔Medium〕补填窗口仅保存草稿时不消耗,可窗口期内反复编辑** → 见 P0-3。
- **D3〔Medium〕进度页默认期硬编码 2026-06,与首页"上海当前年月"不一致**:`progress/page.tsx:9-10`(`DEFAULT_YEAR=2026/DEFAULT_MONTH=6`)vs 首页 `page.tsx:24` 用 `getShanghaiDateParts()`。用户进入 /progress 默认落在一个可能"永远不可写"的月份。修复:默认值改用 `getShanghaiDateParts()`。
- **D4〔Medium〕cron 审计导出 `rangeStart` 依赖可被删除的 `latestArchive.rangeEnd`**:`cron/audit-export/route.ts:33-47`;`cycleCount>=4` 时 `deleteMany` 清空 auditLog 且按 `expiresAt` 删过期 archive。跨自然年边界、archive 与日志均被清理后,`rangeStart=now/rangeEnd=now` 可能造成审计空窗或边界重叠。修复:用持久游标字段记录上次 `rangeEnd`,统一半开区间;补"年末末次导出 → 次年首次导出"回放测试。
- **D5〔Low〕导出 Excel 全量载入内存 + base64 经 server action 回传**:`export-excel.ts:21-54`,大数据量下内存与 RSC payload 膨胀(base64 +33%)。建议改流式下载路由(参考 audit-export GET route)。
- **D6〔Low〕`import-users` 逐行串行 `bcrypt.hash(cost 12)` + 逐行 create**:`import-users.ts:69-85`,大批量慢、部分失败不回滚("尽力导入"语义,可接受)。
- **D7〔Low〕notification PATCH 非法 body 回退 `{}` 后可静默"全部标记已读"**:`api/notifications/route.ts:35`(`request.json().catch(()=>({}))` 再 `.parse`,空对象通过 refine)。修复:空 body 显式拒绝。

### 正面观察(值得保留)
- 写操作普遍把 业务写 + 通知 fan-out + auditLog 包在同一 `$transaction`(`grant-tag.ts:61-96`、`create-comment.ts:36-70`、`create-node.ts:25-66`),原子性好。
- 通知 fan-out 统一经 `shouldNotifyRecipient`/`uniqueNotificationRecipientIds` 排除 actor 自身并去重。
- 状态机显式守卫:仅 IN_PROGRESS 可归档、解档 7 天冷却、毕业用 `updateMany where status not GRADUATED` + `count===1` 乐观并发 + 联动撤销有效 Tag。
- 提交编辑次数限制 + UI `disabled={isSubmitted}` 双重防重复提交。
- 软删除 `deletedAt` + Tag `revokedAt`/`expiresAt` 在所有读路径一致过滤;时间统一走上海时区。

### 误报澄清(经代码核实排除,未计入缺陷)
README 关于"示例数据/通知返回空/评论与时间线未接库"已过时;"项目组长不在 fan-out""save-report 空指针""提交报告烧 quota"经核实均为误报。

---

## 7. 头脑风暴:改进路线图(按优先级)

**P0 — 接真实数据/验收前必做**
1. **接上 `admin/settings` 后端**(P0-2):唯一真断点,"假按钮"最易被验收识破。
2. **修复"check-and-consume 同事务"模式**(P0-1 限流 + P0-3 补填):抽象 `enforceRateLimit(tx,…)`/`consumeBackfillWindow(tx,…)`,从结构上根治,而非逐点打补丁。
3. **引入"请求级用户上下文"**(P0-4):用 React `cache()` 包裹 user+permissions+tags 单次加载,所有 `getUserPermissions/getEffectiveTags/requireActiveUser` 共享。接真实数据前落地收益最大。
4. **轮换 `AUTH_SECRET`/`ADMIN_PASSWORD` + 密钥入管理器 + CI gitleaks**(P0-5)。
5. **统一 `FormFeedback`(`role=alert`/`status`)**(P0-6):一次性修可访问性静默 + tone 不一致(M3)。

**P1 — 结构性收敛**
6. **授权决策统一为单一 `can(user, action, resource)` 门面**(A2):把 permission-set / project-lead-tag / own-any 三套收敛到一个可审计、可测试入口;敏感拒绝全部进 `auditPermissionDenied`。
7. **加 DB 级唯一/外键约束**(S4、S5):`ProgressReport(userId,year,month)`、活跃 `UserTag` 部分唯一索引、`ProjectNode.parentId` 同项目 FK 守卫,让并发无法违反应用不变量。
8. **统一错误层 + i18n 边界**(A4):错误码 + 中文 `userMessage`,杜绝内部英文泄漏。
9. **API route 统一守卫适配层**(A5):route 只做协议转换,业务/授权下沉 application-service;修正 `redirect` 在 API 的语义错配。

**P2 — 打磨与硬化**
10. **破坏性操作确认 + 成功 toast 体系**(C2、M2)。
11. **清理"假 UI"**:登录页假数据(M1)、Header 假搜索(H5)。
12. **可访问性基线一遍过**:reduced-motion(M4)、移动导航 dialog 化(H4)、select `aria-label`(M2)、链接 focus-visible(L3)、空态(M5)+ `loading.tsx`(M6)。
13. **状态/枚举中文映射 + 语义 Badge 系统**(H1、H2、L1)。
14. **安全响应头 + cron Bearer-only**(S7、S8);Tag 权限写时白名单校验(S9)。
15. **更新 README**:当前描述与代码不符,会误导验收与后续开发者。

---

## 附录:审阅方法与边界

- **方式**:全程只读,未修改、创建或删除任何源码(本文档为唯一产物)。所有 `路径:行号` 均来自实际读到的代码。
- **覆盖**:`src/features/**`、`src/app/(dashboard)/**`、`src/app/api/**`、`src/shared/lib/**`、`prisma/schema.prisma`、`next.config.ts`、`.env`;并交叉验证 `npm audit`(0 漏洞)、`tsc --noEmit`(通过)。
- **未逐行**:少数 `[id]` 详情页与 `commit-graph-view.tsx`/`project-node-views.tsx` 未逐行,但已覆盖其共用原子组件与同构模式,系统性结论对其同样适用。
- **置信度**:被多个独立 agent 命中的发现(P0-1、P0-2、P0-3)置信度最高;`Open Question`(D4 跨年审计连续性)需运行期多周期/跨年数据回放确认。
- **基线尊重**:`ADMIN` 治理不创作内容、能力由 Tag 叠加、项目级 Tag 不跨项目串权——均作为有意不变量,符合即合格,未当作缺陷。
