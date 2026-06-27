# 实验室协作管理平台

这是一个可运行的 MVP，不是只看页面的静态 demo，也还不是生产可上线的完整产品。

当前版本已经完成：Next.js App Router 应用、Prisma/PostgreSQL 数据模型、NextAuth 登录、DB-backed 会话校验、动态 Tag 权限引擎、审计日志、帖子/评论、公告/通知、项目治理与提交图谱、进度报告时间窗口/补填/Excel 导出，以及自动化验证。

当前版本仍属于 MVP 的原因：尚未完成生产部署加固、对象存储/备份、Tag 自助申请审批等运营闭环；系统设置仍以基础配置为主。当前主要业务页面均读取真实数据库，不再依赖静态示例列表。

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

审计自动导出由外部调度器调用受保护路由，需在 `.env` 设置 `CRON_SECRET`。示例：

```bash
0 3 */7 * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/audit-export
```

更稳定的周调度可用：

```bash
0 3 * * 0 curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/audit-export
```

## 使用路径

### 登录

打开 `/login`，输入管理员账号。首次登录会跳转到 `/change-password`。

### 管理后台

管理员可访问：

- `/admin`：管理后台入口
- `/admin/users`：创建/导入成员，修改身份、角色、状态、导师和年级
- `/admin/tags`：授予/撤销全局 Tag，并查看权限明细
- `/admin/audit`：审计日志分页、筛选与导出
- `/admin/settings`：基础系统设置

管理员是治理角色：不能发帖或作为项目导师创作内容，但可以代有效导师创建项目、恢复软删除项目和执行永久删除。

### 公告

入口：`/announcements`

公告列表每页 10 条，总览展示 5 条；发布、定向通知、删除、分页和审计均已接入数据库。通知收件人会自动包含活动管理员。

### 项目

入口：`/projects`

项目列表、创建、成员树、节点、名称/简介编辑和提交图谱均已接入数据库。导师只能选择直属在读学生；admin 代创建时必须选择实际导师。学生只可查看自己参与项目的简报。项目级 Tag 始终按 `projectId` 隔离。

生命周期语义：归档与删除分离；负责导师可软删除自己的项目，admin 可恢复或永久删除，项目组长可按项目权限归档/取消归档。

### 进度报告

入口：`/progress`

报告表单、报告列表、汇总表和导出均已接入数据库：

- 每月 25-27 日按 Asia/Shanghai 判断填写窗口
- `progress.backfill` 补填窗口
- 补填窗口服务端固定 24 小时有效期
- 提交后消费补填窗口
- 导出权限和审计

页面默认使用当前北京时间月份，可浏览历史月份；北京时间每月 25–27 日开放当月填写，管理员可开启 24 小时补填窗口。已提交报告不能重复提交，但最多可再保存修改 3 次。导师只看到直属学生，进度管理员可查看与导出全局数据。

### 通知

入口：`/notifications`

通知 hook 按 30 秒轮询 `/api/notifications`。页面和 API 都使用每页 5 条的服务端分页，返回全局未读数，并支持单条/全部已读和恢复未读。

## 权限模型摘要

基础角色：

- `ADMIN`：网站治理角色，可管理用户、Tag、设置、审计和内容治理；不能创作内容。
- `MEMBER`：普通成员，默认只读，能力由 Tag 叠加。

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

端到端 / 浏览器冒烟测试（需要本地数据库与开发服务器在运行）：

```bash
npm run e2e:fixtures   # 准备 E2E 测试数据
npm run e2e:smoke      # 关键路由与权限冒烟
npm run e2e:browser    # 浏览器流程，截图写入 .omx/reports/
```

当前最新验证结果：

- `npm run verify`：通过，176 个测试
- `npm run build`：通过，静态生成阶段 25/25 完成
- `npm audit --audit-level=moderate`：0 vulnerabilities
- `npm run e2e:smoke`：连续两次通过，覆盖身份、权限、5/10 分页与毕业账号拒绝
- `npm run e2e:browser`：连续两次通过，覆盖真实表单、恶意文本安全渲染、项目图谱交互与自动清理

## 当前完成度判断

准确地说：这是一个工程可运行、核心业务闭环已落地的 MVP。

它不是纯 demo，因为核心后端边界已经实现并有测试保护：认证、权限、会话吊销、审计、补填、rate limit、Prisma migration 和安全审计都已经跑通。

它也不是完整生产产品：Tag 自助申请审批、生产级文件存储/备份、监控告警与部署加固仍需补齐。

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
