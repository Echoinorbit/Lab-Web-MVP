# 实验室协作管理平台

这是一个可运行的 MVP，不是只看页面的静态 demo，也还不是生产可上线的完整产品。

当前版本已经完成：Next.js App Router 应用、Prisma/PostgreSQL 数据模型、NextAuth 登录、DB-backed 会话校验、动态 Tag 权限引擎、审计日志、帖子/评论、公告编辑与通知、项目治理与提交图谱、培养身份/年级、毕业清理、历史署名保留、头像裁剪、数据库持久化进度/Session 设置，以及自动化验证。

当前版本仍属于 MVP 的原因：尚未完成生产部署加固、对象存储/病毒扫描、备份恢复演练、监控告警和 Tag 自助申请审批等运营闭环。当前主要业务页面均读取真实数据库，不再依赖静态示例列表。

## 界面预览

![登录后工作台首页](public/readme/dashboard-home.png)

首页将实验室信息置于 Endfield 风格的固定画布视觉中；后续的项目、进度、帖子、公告、通知、档案和治理区域仍由同一份可滚动工作台承载。

## 界面架构决策

- 首页只保留与工作台实际耦合的仪表盘组件和 6 个图片素材；独立的 `/_endfield` 预览页、其复刻组件和未引用媒体已移除。
- 认证后的导航使用可展开的 Endfield 风格侧栏；完整文字标签在鼠标或键盘焦点进入后出现，移动端把档案与退出操作固定在菜单底部。
- 项目列表使用真实项目和节点日期绘制版本日历，不再把项目映射为游戏角色；原有可见性、Tab 与权限判断仍在服务端查询层执行。
- 公告列表只呈现服务端生成的纯文本摘要，完整 Markdown 仅在详情页渲染。

## 默认账号

种子脚本只创建一个管理员账号。账号密码来自 `.env`：

```env
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="ChangeMe123!"
ADMIN_DISPLAY_NAME="系统管理员"
```

如果直接使用 `.env.example` 的值，登录账号就是：

```text
用户名：admin
密码：ChangeMe123!
```

第一次登录后会强制进入 `/change-password` 修改密码。新密码规则：

- 至少 10 位
- 至少包含 3 类字符：小写字母、大写字母、数字、特殊字符
- 不能包含用户名或学号

改密成功后系统会退出登录；请用新密码重新登录。

## 本地启动

前置要求：

- Node.js 20+
- npm
- PostgreSQL 16 或兼容版本

macOS + Homebrew 可用下面的命令安装并启动 PostgreSQL：

```bash
brew install postgresql@16
brew services start postgresql@16
```

1. 安装依赖：

```bash
npm install
```

2. 准备环境变量：

```bash
cp .env.example .env
```

建议把 `.env` 里的 `AUTH_SECRET` 换成真实随机值：

```bash
openssl rand -base64 32
```

3. 准备 PostgreSQL 数据库。

如果沿用 `.env.example`：

```env
DATABASE_URL="postgresql://lab:lab@localhost:5432/lab_platform?schema=public"
```

需要本机 PostgreSQL 里存在用户 `lab`、密码 `lab`、数据库 `lab_platform`。

可以用下面的命令创建：

```bash
/opt/homebrew/opt/postgresql@16/bin/psql -d postgres -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lab') THEN CREATE ROLE lab LOGIN PASSWORD 'lab'; ELSE ALTER ROLE lab WITH LOGIN PASSWORD 'lab'; END IF; END \$\$;"
/opt/homebrew/opt/postgresql@16/bin/psql -d postgres -c "ALTER ROLE lab CREATEDB;"
/opt/homebrew/opt/postgresql@16/bin/createdb -O lab lab_platform
```

4. 执行迁移并写入种子数据：

```bash
npx prisma migrate dev
env DATABASE_URL="postgresql://lab:lab@localhost:5432/lab_platform?schema=public" \
  ADMIN_USERNAME="admin" \
  ADMIN_PASSWORD="ChangeMe123!" \
  ADMIN_DISPLAY_NAME="系统管理员" \
  npm run seed
```

seed 会创建管理员和系统 Tag 模板。若没有设置 `DATABASE_URL` 和 `ADMIN_PASSWORD`，seed 会失败，这是有意的。

5. 启动开发服务器：

```bash
npm run dev
```

默认访问：

```text
http://localhost:3000
```

审计自动导出和毕业账号清理由外部调度器调用受保护路由，需在 `.env` 设置高强度 `CRON_SECRET`。示例：

```bash
0 3 */7 * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/audit-export
```

更稳定的周调度可用：

```bash
0 3 * * 0 curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/audit-export
```

毕业学生进入 `GRADUATED` 后使用数据库时间安排三天宽限期。建议每小时调用一次幂等清理端点；每批最多处理 50 个到期账号：

```bash
15 * * * * curl -sS --fail-with-body -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/purge-graduated-users
```
## Linux 生产部署

仓库提供基于 Ubuntu/Debian、PostgreSQL 16、PM2 和 Nginx 的单机部署说明：

- [Linux 单机生产部署说明](docs/linux-deployment.md)：首次部署、环境变量、HTTPS、外部定时任务、备份、升级、回滚和上线检查
- [全栈整改运维手册](docs/fullstack-remediation-operations.md)：运行维护、账号清理、上传目录和监控要求
- [数据库迁移手册](docs/fullstack-remediation-migration.md)：迁移演练、维护窗口和恢复流程

生产环境使用 `npm ci`、`npx prisma migrate deploy` 和 `npm run build`，不要使用 `prisma migrate dev`、`migrate reset` 或 `db push`。当前上传文件保存在本地磁盘，因此这套方案面向单实例、持久磁盘部署。

## 使用路径

### 登录

打开 `/login`，输入管理员账号。首次登录会跳转到 `/change-password`。

### 管理后台

管理员可访问：

- `/admin`：管理后台入口
- `/admin/users`：创建/批量导入成员并进入独立编辑页
- `/admin/users/[userId]/edit`：修改角色、培养身份、年级、导师、状态、毕业生命周期和永久删除
- `/admin/tags`：授予/撤销全局 Tag，并查看权限明细
- `/admin/audit`：审计日志分页、筛选与导出
- `/admin/settings`：基础系统设置

管理员是治理角色：不能发帖或作为项目导师创作内容，但可以代有效导师创建项目、恢复软删除项目和执行永久删除。

### 公告

入口：`/announcements`

公告列表每页 10 条，总览展示 5 条；发布、作者编辑、定向通知、删除、分页和审计均已接入数据库。作者只能编辑自己的公告，服务端会拒绝越权编辑；通知收件人会自动包含活动管理员。

### 项目

入口：`/projects`

项目列表、创建、成员树、节点、名称/简介编辑和提交图谱均已接入数据库。导师只能选择直属在读学生；admin 代创建时必须选择实际导师。学生只可查看自己参与项目的简报。项目级 Tag 始终按 `projectId` 隔离。

生命周期语义：归档与删除分离；无未删除节点的活动项目派生为“规划中”，新增节点后派生为“进行中”，而“已归档”和“已完成”优先级更高。项目使用 `leaderId` 作为唯一组长来源，并同步项目级组长 Tag。Admin、规范组长或具有当前项目管理权限的成员可归档/取消归档；普通成员会被服务端拒绝。负责人被停用、毕业、提升为管理员、改为导师、转投其他导师或删除后，活动项目进入“待重新分配”且不会静默提拔其他成员；终态项目只保留署名快照。仍负责未结束项目（含软删除但可恢复项目）的导师不能被停用、改为非导师或删除，须先恢复后归档/完成，或永久删除相关项目。

### 进度报告

入口：`/progress`

报告表单、报告列表、汇总表和导出均已接入数据库：

- 由数据库系统设置定义每月开始/结束日与分钟，按 Asia/Shanghai 判断填写窗口（初始值为 25 日 00:00 至 27 日 23:59）
- `progress.backfill` 补填窗口
- 补填窗口服务端固定 24 小时有效期
- 提交后消费补填窗口
- 导出权限和审计

页面默认使用当前北京时间月份，可浏览历史月份；管理员可在 `/admin/settings` 修改真实填写窗口，并可开启 24 小时补填窗口。已提交报告不能重复提交，但最多可再保存修改 3 次。导师只看到直属学生，进度管理员可查看与导出全局数据。

### 头像

入口：`/profile`

浏览器端将 JPEG/PNG/WebP 原图裁剪为 512 × 512 PNG，服务端仍会重新校验 PNG 签名、CRC、尺寸、位深、数据块顺序、解压后长度和 2 MiB 上限。文件以 UUID 名写入 `public/uploads/avatars`，数据库只保存受管公开路径；替换或删除账号时清理旧文件。未设置头像统一回退到 `public/avatar/default.png`，默认头像不得由清理任务删除。

### 批量导入成员

在 `/admin/users` 下载当前模板。表头顺序固定为：

```text
username, displayName, password, studentId, studyDegree, studyGrade
```

- `studyDegree` 接受 `硕士`/`MASTER`、`博士`/`DOCTOR`、`导师`/`MENTOR`。
- 硕士年级仅 `研0`–`研3`，博士年级仅 `博1`–`博5`，导师的 `studyGrade` 必须留空。
- 文件最大 5 MiB、最多 500 个非空数据行；身份字段中的公式或外部链接会被拒绝。
- 先执行签名预览，再在五分钟内确认同一文件；导入在事务中创建账号、培养身份和规范系统 Tag，任一行冲突会阻止整批提交。
- 初始密码遵循与单个开通相同的策略，首次登录必须改密。

### 通知

入口：`/notifications`

通知 hook 按 30 秒轮询 `/api/notifications`。页面和 API 都使用每页 5 条的服务端分页，返回全局未读数，并支持单条/全部已读和恢复未读。

## 权限模型摘要

基础角色：

- `ADMIN`：网站治理角色，可管理用户、Tag、设置、审计和内容治理；不能创作内容。
- `MEMBER`：普通成员，默认只读，能力由 Tag 叠加。

培养身份与角色分离：

- `studyDegree`：`MASTER`、`DOCTOR`、`MENTOR`；管理员可为空。
- `studyGrade`：硕士 `MASTER_0`–`MASTER_3`，博士 `DOCTOR_1`–`DOCTOR_5`，导师必须为空。
- `grad-master`、`grad-phd`、`advisor` 是培养身份的规范能力投影，来源为 `STUDY_IDENTITY`；不要把它们当作任意自定义 Tag 手工维护。

全局 Tag：

- `grad-master`：硕士，可发帖、评论、写/交月报
- `grad-phd`：博士，可发帖、评论、写/交月报
- `advisor`：导师，可发帖、评论、发布公告、创建项目
- `progress-mgr`：进度管理，可看全部月报、导出、开启补填
- `graduated`：毕业标记，不增加权限

项目级 Tag：

- `project-lead:{projectId}`
- `project-member:{projectId}`

项目级权限必须带 `projectId` 校验，不能在不同项目之间串权。

## 验证命令

完整验证：

```bash
npm run verify
```

包括：

- Prisma Client generate
- TypeScript typecheck
- ESLint
- Node test runner
- Prisma schema validate

生产构建：

```bash
npm run build
```

依赖安全审计：

```bash
npm audit --audit-level=moderate
```

迁移/数据一致性只读检查：

```bash
npm run remediation:readiness
```

其 JSON 中 `ready` 必须为 `true`。正式迁移、隔离 schema 演练和回滚命令见 [迁移手册](docs/fullstack-remediation-migration.md)。

PostgreSQL 事务、触发器、并发组长投影和账号清理集成套件：

```bash
npm run test:integration
```

该命令从 `.env` 的数据库连接派生两个可丢弃 schema：先在 `remediation_upgrade_*` 中部署旧迁移、注入对抗性旧数据并单独执行整改迁移，再在 `remediation_it_*` 中验证全量迁移、seed 与运行时并发契约。两者都会在 `finally` 自动删除；运行账号必须具有创建/删除 schema 的权限。它不会把测试表写入连接中原有的应用 schema。

端到端 / 浏览器冒烟测试（需要本地数据库与开发服务器在运行）：

```bash
npm run e2e:fixtures   # 准备 E2E 测试数据
npm run e2e:smoke      # 关键路由与权限冒烟
npm run e2e:browser    # 浏览器流程，截图写入 .omx/reports/
```

数据库/生命周期改动还必须在明确指定的可丢弃 schema 上运行 PostgreSQL 集成套件；不要将该命令指向共享或生产 schema。以 `package.json` 和 [迁移手册](docs/fullstack-remediation-migration.md) 中的当前命令为准。验证结果属于具体提交的交付证据，不在 README 中保存容易过期的测试计数。

## 当前完成度判断

准确地说：这是一个工程可运行、核心业务闭环已落地的 MVP。

它不是纯 demo，因为核心后端边界已经实现并有测试保护：认证、权限、会话吊销、审计、补填、rate limit、Prisma migration 和安全审计都已经跑通。

它也不是完整生产产品：Tag 自助申请审批、生产级对象存储/病毒扫描、数据库和上传目录备份、监控告警与部署加固仍需补齐。

## 常见问题

### 登录后为什么要求改密码？

seed 创建的管理员 `mustChangePassword=true`。这是为了模拟导入/初始化账号的安全流程。改密成功后会自增 `tokenVersion` 并吊销旧会话。

### 输入默认账号密码仍然登录失败怎么办？

先确认 PostgreSQL 正在运行，并且迁移和 seed 已经执行：

```bash
/opt/homebrew/opt/postgresql@16/bin/pg_isready -h localhost -p 5432
npx prisma migrate deploy
env DATABASE_URL="postgresql://lab:lab@localhost:5432/lab_platform?schema=public" ADMIN_USERNAME="admin" ADMIN_PASSWORD="ChangeMe123!" ADMIN_DISPLAY_NAME="系统管理员" npm run seed
```

如果数据库没有启动，登录接口无法查询 `User` 表，页面会显示登录失败。

### 为什么管理员不能发帖，但能代创建项目？

这是架构约束。`ADMIN` 是治理角色，不是内容创作者，因此不能发帖，也不能把自己设为项目导师；它只能选择持有效 `advisor` Tag 的成员代为创建项目。需要以导师身份创作内容时，应使用 `MEMBER` 账号并授予 `advisor` Tag。

### 为什么修改 Session 时长后需要重新登录？

Session 时长在成功登录时从数据库读取并写入该会话的策略过期时间。管理员修改时长时，系统会在同一事务内递增所有账号的 `tokenVersion`，立即使现有会话失效；所有用户重新登录后按新时长建立会话。系统不会仅靠客户端 Cookie 的理论最大时长绕过数据库策略过期。

### 为什么顶部没有全局搜索？

当前版本没有搜索后端。为避免展示一个不能提交的假搜索框，Header 不渲染全局搜索；需要搜索时应先定义索引、权限过滤和结果范围，再完整实现。

### 如何查看数据库？

可以使用 Prisma Studio：

```bash
npx prisma studio
```

### 之后最该补什么？

优先补齐这些生产闭环：

- Tag 自助申请与审批流
- 上传文件的对象存储、病毒扫描与生命周期管理
- 数据库备份、恢复演练和生产监控告警
- 分页帖子列表与有权限边界的搜索
