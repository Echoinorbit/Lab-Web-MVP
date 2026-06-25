# 实验室协作管理平台

这是一个可运行的 MVP 基座，不是只看页面的静态 demo，也还不是生产可上线的完整产品。

当前版本已经完成：Next.js App Router 应用骨架、Prisma/PostgreSQL 数据模型、NextAuth 登录、DB-backed 会话校验、动态 Tag 权限引擎、审计日志、进度报告时间窗口/补填规则、基础页面和自动化验证。

当前版本仍属于 MVP 基座的原因：部分列表页仍使用示例数据展示，若干后台 CRUD、Tag 审批、帖子评论全流程、项目时间线完整交互还没有全部接真实数据库 UI。

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
- `/admin/users`：用户管理页面骨架
- `/admin/tags`：Tag 管理页面骨架
- `/admin/audit`：审计日志页面骨架
- `/admin/settings`：系统设置页面骨架

这些页面已经有服务端权限保护，但部分操作 UI 仍是 MVP 骨架。

### 公告

入口：`/announcements`

当前有公告列表和发布表单 UI。后端已提供 `createAnnouncement` server action，包含权限校验、目标校验、通知创建事务和审计逻辑；页面上的表单还没有完整接入真实提交流程。

### 项目

入口：`/projects`

当前有项目列表和创建项目 UI。后端已提供创建项目、创建节点、归档项目等 server action，并实现项目级 Tag 的 projectId 范围校验；列表页目前仍展示示例数据。

### 进度报告

入口：`/progress`

当前有报告表单、报告列表、汇总表和导出按钮 UI。后端已实现：

- 每月 25-27 日按 Asia/Shanghai 判断填写窗口
- `progress.backfill` 补填窗口
- 补填窗口服务端固定 24 小时有效期
- 提交后消费补填窗口
- 导出权限和审计

页面 UI 仍需要继续接入真实提交/导出交互。

### 通知

入口：`/notifications`

通知 hook 已按 30 秒轮询 `/api/notifications`；当前 API 返回空数组，真实通知列表查询还需要继续补全。

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

- `npm run verify`：通过，21 个测试
- `npm run build`：通过
- `npm audit --audit-level=moderate`：0 vulnerabilities

## 当前完成度判断

准确地说：这是一个工程可运行、架构不变量已落地的 MVP 基座。

它不是纯 demo，因为核心后端边界已经实现并有测试保护：认证、权限、会话吊销、审计、补填、rate limit、Prisma migration 和安全审计都已经跑通。

它也不是完整生产 MVP，因为一些产品工作流还停留在 UI 骨架或示例数据阶段，需要继续把页面表单、列表查询、审批流、导入流和通知流完整接到数据库。

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

### 为什么管理员不能发帖/创建项目？

这是架构约束。`ADMIN` 是治理角色，不是内容创作者。需要创作内容时，应创建一个 `MEMBER` 账号并授予对应 Tag，例如 `advisor`。

### 为什么有些页面看起来有数据但数据库里没有？

部分页面仍使用示例数据，目的是先固定信息架构和 UI 结构。真实数据接入需要继续实现页面级查询和表单提交。

### 如何查看数据库？

可以使用 Prisma Studio：

```bash
npx prisma studio
```

### 之后最该补什么？

优先补齐这些产品闭环：

- 管理员创建/导入 MEMBER 账号
- Tag 申请、审批、撤销 UI
- 公告、项目、进度报告页面的真实提交和查询
- 帖子与评论的创建/删除流程
- 通知列表真实查询与已读状态
