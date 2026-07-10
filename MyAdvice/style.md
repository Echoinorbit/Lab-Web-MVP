# style.md — 指导 Codex 用 `/impeccable` 把 gewu 的样式套用到 lab-platform

> 读者：**Codex**（在 `/Users/gaussprime/CODE/WEB` 即 `lab-platform` 仓库里工作）。
> 目标：用 `/impeccable` 技能，把参考项目 **gewu** 的「黑白单色 + 苹果蓝」视觉体系，**合适地套用到本站**。
> 红线：**只改样式（颜色/间距/排版/布局），绝不改动任何业务流（认证、权限、数据、状态机、审批、校验）。**

---

## 0. 一句话任务

把 lab-platform 从当前「青绿(teal) shadcn 主题」改造成 **gewu 已落地的「apple.com 黑白灰 + 苹果蓝 `#0066cc` 点缀」体系**，且保持**所有功能与业务逻辑零行为变化**。这主要是一次**令牌替换 + 组件样式打磨**，不是重写。

参考样式源（**只读，作为唯一视觉事实**）：
- `/Users/gaussprime/CODE/gewu/DESIGN.md` — gewu 设计体系（黑白苹果 + 令牌表 + 与本站的兼容映射）
- `/Users/gaussprime/CODE/gewu/REDESIGN-BRIEF.md` — 设计纲领（必删 slop、配色策略、苹果布局原则）
- `/Users/gaussprime/CODE/gewu/src/app/globals.css` — gewu 的实际令牌（OKLCH 值）
- `/Users/gaussprime/CODE/gewu/src/components/ui/` — gewu 的原语实现（按钮 pill、卡片柔和阴影等）

---

## 1. 铁律：绝不改动业务流（最重要）

本站是真实业务系统（实验室协作平台），含认证、RBAC 权限、审计、毕业状态机、数据校验。你**只能改 className / 样式 / 布局结构**，**不得改任何逻辑**。

### 1.1 绝对禁区文件（整文件不可改，连一行逻辑都不要碰）

**认证 / 会话 / 路由保护：**
- `src/shared/lib/auth.ts`（NextAuth 配置、登录限流、账户锁定、JWT/session 回调）
- `src/middleware.ts`（路由层认证预过滤、未登录重定向）
- `src/shared/lib/session.ts`（`requireActiveUser()`、tokenVersion 校验、自动毕业、强制改密）
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/features/auth/actions/change-password.ts`、`src/features/auth/actions/logout.ts`
- `src/shared/lib/validators/auth.ts`、`src/types/next-auth.d.ts`

**权限 / 授权 / 审计：**
- `src/shared/lib/permissions.ts`（PERMISSIONS、ROLE_PERMISSIONS、computePermissionsFromSnapshot）
- `src/shared/lib/authorization.ts`（assertPermissionWithAudit 等）
- `src/shared/lib/access-denied.ts`、`src/shared/lib/audit.ts`

**用户状态机 / 毕业 / 治理：**
- `src/shared/lib/user-status.ts`、`src/shared/lib/graduation.ts`
- `src/features/admin/lib/user-status-management.ts`、`src/features/admin/lib/user-governance.ts`

**所有 Server Actions（纯逻辑，零 UI）：**
- `src/features/admin/actions/*.ts`（create-user / update-user-status / update-user-identity / update-user-role / update-user-advisor / update-user-grade / revoke-user-sessions / import-users）

**校验与数据模型：**
- `src/shared/lib/validators/admin.ts`（Zod schema）
- `prisma/schema.prisma`

### 1.2 永不触碰的代码模式（即便文件里有 UI）

- 任何 `requireActiveUser()` / `requirePermission()` / `assertPermission*()` 调用 —— 不删、不改名、不挪位置。
- 任何 `signIn()` 参数、错误分类（如 `CredentialsSignin`）、重定向（`redirect(...)` / `window.location.href`）。
- 任何 `tokenVersion` 递增、session 撤销、`mustChangePassword` 流程。
- 任何 Zod `.parse()`、`prisma.$transaction(...)`、Prisma 查询的 `where`（尤其 tag 的 `revokedAt` / `expiresAt` 过滤——它是权限计算的一部分）。
- 表单 `<input>` 的功能属性：`name` / `required` / `minLength`（如改密 `minLength=10` 是密码策略）/ `type`。这些是行为，不是样式。
- 业务文案：密码规则提示、毕业不可逆警告（`window.confirm(...)`）等——属于业务语义，不要改写。

### 1.3 UI 与逻辑耦合的高危组件（可改样式，逻辑禁改）

| 文件 | ✅ 可改 | ❌ 禁改 |
|---|---|---|
| `src/features/admin/components/user-table.tsx` | className、间距、边框、表格排版、操作按钮外观 | `onClick`/`run()`/server action 调用、role/status/isAdvisor 条件渲染、`window.confirm`、error 处理 |
| `src/features/admin/components/user-create-form.tsx` | grid 布局、label/输入框样式 | `<input name>`、required、密码规则文本、与 `createUserFormAction` 的绑定 |
| `src/app/(dashboard)/admin/users/page.tsx`（服务端组件） | Card 容器、页头、section 布局 | Prisma 查询、`requirePermission()`、数据转换 |
| `src/features/auth/components/login-form.tsx` | Card/Label/Input/Button 样式、loading 态、错误色 | `signIn()`、错误分类、重定向 |
| `src/features/auth/components/change-password-form.tsx` | 表单样式 | `useActionState` 绑定、`minLength`、submit 逻辑 |
| `src/app/(dashboard)/layout.tsx` | Header / Sidebar / MobileNav 的 className 与布局 | `requireActiveUser()`、权限加载、导航可见性计算 |

> §1.3 的 ✅/❌ 拆分原则**适用于 §6 的每一个页面**：本站绝大多数页面（admin/*、projects、posts、announcements 等）都含 `requirePermission()`/`requireActiveUser()`/Prisma 查询，它们由 §1.2 的**全局模式红线**统一保护——即便某文件没在 §1.3 表里逐条列出，同样只许改样式。
>
> 速记：**只改"长什么样"，不改"做什么"。** 任何会改变数据流、权限流、状态转换、表单校验、跳转行为的改动都越线。

---

## 2. 样式住在哪里（你只在这里工作）

WEB 已是**干净的 shadcn 令牌化**架构，90%+ 用语义类（`bg-primary`/`text-muted-foreground`/`border` 等），几乎无硬编码颜色。所以套用 gewu 风格 = **改令牌 + 打磨组件**，影响面集中：

1. **令牌（核心，改这一处影响全站）**：`src/app/globals.css` 的 `:root` 与 `.dark` 块（共 16 个 CSS 变量）。
2. **Tailwind 映射**：`tailwind.config.ts`（颜色都经 `hsl(var(--*))`，**通常无需改**；除非要新增 `accent-soft` 等）。
3. **UI 原语**：`src/shared/components/ui/`（`button.tsx`/`card.tsx`/`input.tsx`/`label.tsx`/`badge.tsx`/`textarea.tsx`/`pagination.tsx`）。另有 `src/shared/components/data-table.tsx`（注意：**在 `components/` 下，不在 `ui/` 子目录**）。改这里 = 改全站控件外观，**改后必须多页验证**。
4. **布局**：`src/shared/components/layout/`（`header.tsx`/`sidebar.tsx`/`mobile-nav.tsx`/`user-menu.tsx`/`theme-toggle.tsx`）。
5. **唯一硬编码颜色**：`src/features/projects/lib/author-color.ts`（`authorPalette` 数组里 12 个 hex，用于 commit graph 作者区分，内联 `style`）。见 §5.3。

**暗色模式**：本站用 `darkMode: ["class"]` + `theme-toggle`，有完整 `.dark`。**苹果风也要做亮/暗双套**，两套都要过对比度。

---

## 3. 目标设计体系（gewu 黑白苹果，摘要）

以 gewu 的 `DESIGN.md` 为准，要点：

- **画布**：黑白灰。亮色 `#f5f5f7` 背景 / 白卡 / `#1d1d1f` 近黑文字；暗色为中性近黑（非青绿染色）。**禁止奶油/米/沙色**。
- **唯一强调色**：苹果蓝 `#0066cc`（暗色用更亮的 `#0a84ff`），**仅用于**链接、主操作、选中态、focus ring。覆盖面 **≤10%**，其余全灰阶。
- **标题单色**：标题用近黑，**靠字重/字号强调，不靠颜色**（不要给标题词染蓝）。
- **字体**：SF 优先栈（`-apple-system, BlinkMacSystemFont, "SF Pro Text/Display"` → 回退 Geist/系统）；标题 semibold(600)、紧字距。
- **按钮**：苹果 pill（`rounded-full`）、扁平填充、无阴影；主按钮蓝底白字，次操作用蓝色「文字链接 ›」。
- **卡片**：发丝描边 + 柔和低阴影，**不要辉光、不要工程网格、不要满屏装饰**。
- **布局**：大留白、舒展；营销/概览屏可居中大标题（苹果 tile 式），产品/数据屏保持克制紧凑网格。
- **动效**：仅状态级（150–250ms），尊重 `prefers-reduced-motion`。

必删 slop（gewu BRIEF §2）：辉光、`bg-grid` 工程网格、渐变文字、每段 uppercase mono eyebrow、彩色标题词。

---

## 4. 令牌映射与建议起始值

gewu 的令牌与本站 shadcn 槽位**一一对应**，套用就是把目标色塞进对应 HSL 槽（shadcn 用 `H S% L%` 空格格式）。以下为**起始建议值**，最终须用 `/impeccable audit` 校验对比度后微调。

### 4.1 `:root`（亮色）建议

```css
:root {
  --background: 240 10% 96%;     /* #f5f5f7 apple 浅灰 (原 210 20% 98%) */
  --foreground: 240 6% 12%;      /* #1d1d1f 近黑 (原 222 28% 14%) */
  --card: 0 0% 100%;             /* 白，保持 */
  --card-foreground: 240 6% 12%;
  --primary: 210 100% 40%;       /* #0066cc 苹果蓝 (原 164 72% 24% 青绿) */
  --primary-foreground: 0 0% 100%;
  --secondary: 240 6% 90%;       /* 中性浅灰 chip (原 43 72% 92% 暖黄→去暖) */
  --secondary-foreground: 240 6% 20%;
  --muted: 240 9% 94%;
  --muted-foreground: 240 4% 38%;/* 次级文字，确保 ≥4.5:1 */
  --destructive: 0 72% 44%;      /* 红，保持(功能色) */
  --destructive-foreground: 0 0% 100%;
  --border: 240 6% 83%;          /* #d2d2d7 (原 214 18% 84%) */
  --input: 240 6% 83%;
  --ring: 210 100% 40%;          /* 同 primary */
  --radius: 0.5rem;              /* 保持 */
}
```

### 4.2 `.dark`（暗色）建议

```css
.dark {
  --background: 240 6% 10%;      /* 中性近黑 (原 222 24% 9%) */
  --foreground: 240 9% 96%;
  --card: 240 5% 13%;
  --card-foreground: 240 9% 96%;
  --primary: 210 100% 52%;       /* #0a84ff 暗色苹果蓝 (原 166 58% 44%) */
  --primary-foreground: 0 0% 100%;
  --secondary: 240 4% 20%;
  --secondary-foreground: 240 9% 90%;
  --muted: 240 4% 18%;
  --muted-foreground: 240 5% 66%;
  --destructive: 0 66% 48%;
  --destructive-foreground: 0 0% 100%;
  --border: 240 4% 24%;
  --input: 240 4% 24%;
  --ring: 210 100% 52%;
}
```

> 说明：以上把原「青绿 primary + 暖黄 secondary」换成「苹果蓝 + 中性灰」，背景/前景转为苹果黑白。**这些是起点，不是终点**——务必用 `/impeccable audit` 在亮/暗双模式逐项验证对比度（正文 ≥4.5:1、大字 ≥3:1、placeholder ≥4.5:1），不达标就把 `--foreground`/`--muted-foreground` 往墨黑端压。
>
> 颜色策略 **Restrained**：蓝色只在交互元素上出现；status/badge 若原来靠 `--secondary` 暖色区分，改中性灰后要确认仍可辨（优先 shape+label，不靠单一色相）。

---

## 5. 如何用 `/impeccable`

`/impeccable` 是设计技能，按子命令工作。建议流程：

### 5.1 先建立上下文与基线
1. 在 WEB 仓库根运行一次 `/impeccable`（无参数）或其 `context.mjs` 让它读到本站 `PRODUCT.md`（register = product）。
2. `/impeccable document` —— 先把当前(青绿)视觉系统记录成 DESIGN.md 基线，便于对照。
3. `/impeccable audit src/app/globals.css` —— 跑一遍 a11y/对比度基线。

### 5.2 落地令牌（地基，先做）
4. 按 §4 改 `src/app/globals.css` 的 `:root` + `.dark`。**这是唯一的全局色源**。
5. `/impeccable audit` 复跑，亮/暗双模式校验对比度，按结果微调令牌。
6. 如需 `accent-soft`（选中行淡蓝底）等 gewu 有而本站没有的语义，再到 `tailwind.config.ts` + globals 增补（参考 gewu 实现），但保持最小改动。

### 5.3 原语与布局（影响全站，做完逐页验证）
7. `/impeccable polish src/shared/components/ui/button.tsx`（按钮改苹果 pill：`rounded-full`、扁平、蓝底；变体 primary/secondary/ghost/destructive 全状态：hover/focus-visible(蓝 ring)/active/disabled）。
8. 同样 polish `card.tsx`（发丝边 + 柔和阴影，去任何辉光）、`input.tsx`/`label.tsx`/`badge.tsx`/`textarea.tsx`/`pagination.tsx`（均在 `src/shared/components/ui/`），以及 `src/shared/components/data-table.tsx`。
9. polish `src/shared/components/layout/`（sidebar/header/mobile-nav）：苹果克制导航，active 项用淡蓝底 + 蓝字。

### 5.4 逐屏打磨（见 §6 优先级）
10. 对每个屏幕用 `/impeccable polish <page-or-component>`，必要时 `/impeccable layout`（间距/留白/节奏）或 `/impeccable typeset`（标题层级）。
11. 数据密集表格屏用 `/impeccable polish` 保持克制紧凑；登录/营销式屏可更舒展、居中。

### 5.5 commit graph 作者色（可选，低优先）
- `src/features/projects/lib/author-color.ts` 里**只有 `authorPalette` 数组的 12 个 hex 字面量是样式**，可改。该文件其余部分是逻辑——`hexColorPattern` 正则、`colorForAuthor` 哈希分配、`resolveAuthorColor`（会优先采用 DB 里 `node.colorHex`）——**一律禁改**。可选：把 `authorPalette` 重调成更克制、与苹果蓝同族/灰阶偏冷的调色板，但**必须保持作者之间可区分**且在亮/暗双底上对比足够。不改也可接受。

> 注意：`/impeccable live` 需要本地 dev server；要在浏览器里挑元素改样式时先 `npm run dev`。

---

## 6. 逐屏执行计划（优先级）

**P1 核心高频（先做，定调全站）**
1. `src/app/(dashboard)/layout.tsx` —— Dashboard 外壳(Sidebar/Header/MobileNav)，影响所有内页
2. `src/app/(dashboard)/page.tsx` —— 仪表盘首页（KPI 卡片 + 公告 + 项目 + 进度汇总）
3. `src/app/(dashboard)/admin/users/page.tsx` + `features/admin/components/user-table.tsx` —— 数据密集表格典型
4. `src/app/(dashboard)/projects/[id]/page.tsx` + `features/projects/components/commit-graph-view.tsx` —— 图谱可视化(视觉焦点，需专门设计；xyflow)
5. `src/app/(dashboard)/projects/page.tsx`、`announcements/page.tsx`、`progress/page.tsx`

**P2 重要模块**
6. `posts/page.tsx`、`posts/[id]/page.tsx`（评论区）、`profile/page.tsx`、`notifications/page.tsx`、`admin/page.tsx`、`admin/audit/page.tsx`

**P3 流程/编辑/认证页**
7. 各 `new` / `edit` 表单页、`(auth)/login`、`(auth)/change-password`、`admin/tags`、`admin/settings`

**屏幕风格归类（套不同的苹果手法）**
- **数据密集/表格**（user-table、audit-log-table、summary-table、各 list）：克制紧凑、发丝分隔、tnum 数字、蓝色仅用于行选中/链接。
- **可视化/图谱**（commit-graph-view、node-canvas、advisor-student-tree）：灰阶节点 + 单一蓝强调（参考 gewu 图谱：项目=蓝、其余灰阶按形状区分），细线边，无辉光。
- **表单/流程**（各 form、登录、改密）：舒展留白、清晰 label、蓝色主按钮 pill。
- **卡片/概览**（仪表盘、admin 首页、project-detail）：白卡 + 发丝边 + 柔和阴影，不要嵌套卡片。

---

## 7. 验收标准（每屏，Codex 自检）

- `npm run typecheck`、`npm run lint`、`npm run build` 全绿。
- `npm run test` 不回归（业务逻辑零改动 → 测试应全过；若有测试挂掉，说明你动到了逻辑，回退）。
- **亮 + 暗双模式**都过 WCAG AA（正文 ≥4.5:1，大字 ≥3:1，placeholder ≥4.5:1）。
- 用 `/impeccable audit` 截图核对 390 / 768 / 1280 三断点，无溢出、无 console 错误。
- **业务流零行为变化**：对照 git diff，确认改动只在 className / 样式 / 令牌 / 布局结构；没有任何 `requirePermission`/`signIn`/`parse`/`$transaction`/`name=`/`required`/`minLength`/`redirect`/`tokenVersion` 的增删改。
- 没有 §3 的 slop（辉光/工程网格/渐变文字/逐段 eyebrow/彩色标题词）。

---

## 8. 给 Codex 的速记

- 你是**只动样式的设计执行者**，不是业务改造者。拿不准某行是不是"业务逻辑"，就**不要碰**，去问或跳过。
- 改全局令牌(`globals.css`) → 改原语(`shared/components/ui`) → 改布局 → 逐屏打磨。先地基后细节。
- 每改一处共享件，到多个页面看一眼是否一致、是否有对比度回归。
- 改完 `git diff` 自审：凡是非样式的 diff，一律回退。
- 视觉事实以 `/Users/gaussprime/CODE/gewu` 的 DESIGN.md / REDESIGN-BRIEF.md / globals.css 为准。

---

*本文件由 lab-platform 团队（多 agent 调研：认证流 / 业务逻辑 / 页面清单 / 样式层 + gewu 设计体系）汇总编写，供 Codex 执行参考。*
