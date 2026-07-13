# Linux 单机生产部署说明

本文面向当前 `lab-platform` MVP，推荐部署形态为：

- Ubuntu 24.04 / Debian 12 单机
- Node.js 当前 LTS（本项目要求 Node.js 20+）
- PostgreSQL 16
- PM2 运行 `next start`
- Nginx 负责 HTTPS 和反向代理

当前头像写入本机 `public/uploads/avatars`，Next.js 缓存也在本机，因此本说明只覆盖单实例、持久磁盘部署。需要多实例或容器弹性扩容时，必须先把头像改为共享对象存储，并处理 Next.js 多实例缓存协调。

## 1. 部署前准备

准备以下信息：

- 已解析到服务器公网 IP 的域名，例如 `lab.example.com`
- 项目 Git 仓库地址
- PostgreSQL 强密码
- 初始管理员账号与强密码
- 两个独立随机密钥：`AUTH_SECRET`、`CRON_SECRET`

服务器只对公网开放 SSH、80、443；不要开放 PostgreSQL 5432 和 Next.js 3000 端口。

安装基础软件：

```bash
sudo apt update
sudo apt install -y git nginx postgresql postgresql-contrib build-essential curl jq
```

创建非 root 运行用户和部署目录：

```bash
sudo adduser --disabled-password --gecos "" labapp
sudo mkdir -p /srv/lab-platform
sudo chown labapp:labapp /srv/lab-platform
```

切换到应用用户，按 [nvm 官方说明](https://github.com/nvm-sh/nvm) 安装 nvm，然后安装当前 Node.js LTS 和 PM2：

```bash
sudo -iu labapp
nvm install --lts
nvm alias default 'lts/*'
npm install -g pm2
node --version
npm --version
pm2 --version
exit
```

`node --version` 必须为 20 或更高。

## 2. 创建 PostgreSQL 数据库

进入 PostgreSQL 管理终端：

```bash
sudo -u postgres psql
```

执行以下 SQL，并替换强密码：

```sql
CREATE ROLE lab_platform LOGIN PASSWORD 'REPLACE_WITH_STRONG_DB_PASSWORD';
CREATE DATABASE lab_platform OWNER lab_platform;
\q
```

数据库密码如果包含 `@`、`:`、`/`、`?`、`#` 等字符，写入连接 URL 前必须进行 URL 编码。

## 3. 拉取项目并配置环境变量

以下命令使用 `labapp` 用户执行：

```bash
sudo -iu labapp
cd /srv/lab-platform
git clone <REPOSITORY_URL> .
cp .env.example .env
chmod 600 .env
```

生成密钥：

```bash
openssl rand -base64 48
openssl rand -hex 32
```

编辑 `/srv/lab-platform/.env`：

```env
DATABASE_URL="postgresql://lab_platform:URL_ENCODED_DB_PASSWORD@127.0.0.1:5432/lab_platform?schema=public"
AUTH_SECRET="PASTE_BASE64_SECRET_HERE"
AUTH_TRUST_HOST=true

# Nginx 是应用前唯一可信代理时设为 1。
# 如果前面还有受控 CDN/负载均衡器，应按真实代理链调整并验证。
TRUSTED_PROXY_HOPS=1

ADMIN_USERNAME="admin"
ADMIN_PASSWORD="REPLACE_WITH_STRONG_BOOTSTRAP_PASSWORD"
ADMIN_DISPLAY_NAME="系统管理员"

CRON_SECRET="PASTE_HEX_SECRET_HERE"
```

注意：

- 不得使用 `.env.example` 中的默认密码或示例密钥。
- 不要随意轮换 `AUTH_SECRET`；轮换会让现有登录会话失效。
- `TRUSTED_PROXY_HOPS` 必须等于受控代理数量。设置过大时应用会把客户端 IP 视为 `unknown`。
- 不要提交 `.env`。

准备可持久写入的头像目录：

```bash
cd /srv/lab-platform
install -d -m 750 public/uploads/avatars
```

整个 `/srv/lab-platform` 应由 `labapp` 持有。发布和备份过程中必须保留 `public/uploads/avatars`；不要把它做成临时目录，也不要允许其中出现符号链接。

## 4. 首次安装、验证与初始化

仍以 `labapp` 用户执行：

```bash
cd /srv/lab-platform
npm ci
npm run verify
npm run build
npm audit --audit-level=moderate
npx prisma migrate deploy
npx prisma generate
npm run seed
npx prisma migrate status
npm run remediation:readiness
```

必须满足：

- `npm run verify` 通过；
- `npm run build` 通过；
- `npx prisma migrate status` 无待执行迁移；
- `npm run remediation:readiness` 输出中的 `ready` 为 `true`。

生产数据库只使用 `prisma migrate deploy`，不要使用 `prisma migrate dev`、`prisma migrate reset` 或 `prisma db push`。

`npm run seed` 使用 upsert 创建初始管理员和系统 Tag。管理员已存在时不会重置其密码，但仍应保护 `.env` 中的引导密码。不要在生产环境运行 `e2e:fixtures`、`e2e:browser` 或其他会写入测试数据的脚本。

## 5. 使用 PM2 启动

仓库已有 `ecosystem.config.js`，默认监听 3000 端口：

```bash
cd /srv/lab-platform
pm2 start ecosystem.config.js --only lab-platform
pm2 status
pm2 logs lab-platform --lines 100
curl -fsS http://127.0.0.1:3000/login >/dev/null
```

配置开机启动：

```bash
pm2 save
pm2 startup
```

`pm2 startup` 会输出一条需要 sudo 执行的命令。记录该命令，退出 `labapp` shell，再用服务器管理员账号执行。以后升级 Node.js 后应重新运行 `pm2 unstartup`、`pm2 startup` 和 `pm2 save`。

```bash
exit
```

## 6. 配置 Nginx 与 HTTPS

创建 `/etc/nginx/sites-available/lab-platform`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name lab.example.com;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

将 `lab.example.com` 替换为真实域名。`client_max_body_size 10m` 用于覆盖项目 8MB 的 Server Action 请求上限；`proxy_buffering off` 保留 Next.js 流式响应。

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/lab-platform /etc/nginx/sites-enabled/lab-platform
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

使用 Certbot、云厂商证书服务或现有证书系统为域名启用 HTTPS，并把 HTTP 重定向到 HTTPS。项目会发送 HSTS 响应头，因此只有证书和 HTTPS 已正确工作后才能开放正式流量。

防火墙示例：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

外部验证：

```bash
curl -fsSI https://lab.example.com/login
```

## 7. 配置外部定时任务

应用不会在 Next.js 进程内运行定时器。需要外部调度两个受保护端点：

- 每小时调用毕业账号清理；
- 每周调用审计导出。

先创建仅 `labapp` 可读的请求头文件，避免把密钥直接放进 crontab 命令行：

```bash
sudo install -d -m 750 -o labapp -g labapp /etc/lab-platform
sudoedit /etc/lab-platform/cron-header
```

文件只写一行，密钥与 `.env` 的 `CRON_SECRET` 完全一致：

```text
Authorization: Bearer REPLACE_WITH_CRON_SECRET
```

设置权限：

```bash
sudo chown labapp:labapp /etc/lab-platform/cron-header
sudo chmod 600 /etc/lab-platform/cron-header
```

编辑应用用户的 crontab：

```bash
sudo -u labapp crontab -e
```

加入以下任务并替换域名：

```cron
15 * * * * /usr/bin/curl -sS --fail-with-body -X POST -H @/etc/lab-platform/cron-header https://lab.example.com/api/cron/purge-graduated-users | /usr/bin/jq -e '.ok == true' >/dev/null || /usr/bin/logger -p user.err -t lab-platform-cron 'graduated-user purge failed'
0 3 * * 0 /usr/bin/curl -sS --fail-with-body -X POST -H @/etc/lab-platform/cron-header https://lab.example.com/api/cron/audit-export | /usr/bin/jq -e '.ok == true' >/dev/null || /usr/bin/logger -p user.err -t lab-platform-cron 'audit export failed'
```

毕业清理端点每批最多处理 50 人。HTTP `207` 或 JSON 中 `ok: false` 表示部分失败，必须告警并重试；`401` 表示调度器密钥不一致。生产环境应把 `lab-platform-cron` 的错误日志接入实际告警系统。

## 8. 备份

数据库与头像必须保存在同一个恢复点。每次迁移或危险运维前，先暂停公开写入和两个 cron，再执行备份。

管理员先创建仅应用用户可读的备份目录，再切换到 `labapp`：

```bash
sudo install -d -m 700 -o labapp -g labapp /srv/backups/lab-platform
sudo -iu labapp
cd /srv/lab-platform
set -a
source .env
set +a
STAMP="$(date +%Y%m%d-%H%M%S)"
pg_dump --format=custom --file="/srv/backups/lab-platform/database-$STAMP.dump" "${DATABASE_URL%%\?*}"
tar -C public/uploads -czf "/srv/backups/lab-platform/avatars-$STAMP.tar.gz" avatars
pg_restore --list "/srv/backups/lab-platform/database-$STAMP.dump" >/dev/null
exit
```

至少定期验证：

- PostgreSQL dump 能被 `pg_restore --list` 读取；
- 头像压缩包可解压；
- 备份已复制到服务器之外；
- 备份保留周期和磁盘告警有效。

数据库恢复必须先恢复到新数据库验证，禁止直接覆盖唯一的生产数据库。完整恢复约束见 [迁移手册](fullstack-remediation-migration.md) 和 [运维手册](fullstack-remediation-operations.md)。

## 9. 后续版本更新

当前数据库迁移包含与旧应用不兼容的字段变更，更新时使用维护窗口，不要让新旧版本同时写生产数据库。

推荐顺序：

1. 记录当前 Git commit 和 `npx prisma migrate status`。
2. 暂停 Nginx 公开流量和两个 cron。
3. 停止 PM2 应用。
4. 同时备份 PostgreSQL 和头像目录。
5. 更新代码、依赖并完成构建。
6. 执行正式迁移、seed 和 readiness。
7. 启动应用并完成内外网检查。
8. 最后恢复公开流量和 cron。

应用命令：

```bash
sudo -iu labapp
cd /srv/lab-platform
git rev-parse HEAD
npx prisma migrate status
pm2 stop lab-platform

# 在完成同恢复点备份后继续
git pull --ff-only
npm ci
npm run verify
npm run build
npm audit --audit-level=moderate
npx prisma migrate deploy
npx prisma generate
npm run seed
npx prisma migrate status
npm run remediation:readiness

pm2 restart ecosystem.config.js --only lab-platform --update-env
pm2 save
curl -fsS http://127.0.0.1:3000/login >/dev/null
curl -fsSI https://lab.example.com/login
exit
```

只有 `verify`、构建、迁移状态和 readiness 全部通过后才能恢复流量。

## 10. 回滚

如果只更新了代码且没有执行数据库迁移，可切回上一 Git commit，重新执行 `npm ci`、`npm run build` 和 PM2 restart。

如果已经执行数据库迁移，不要直接运行旧代码，也不要尝试 `migrate reset`。安全回滚方式是：

1. 把部署前 dump 恢复到一个新数据库；
2. 解压匹配时间点的头像备份；
3. 用旧版本应用连接新数据库；
4. 完成迁移状态、readiness 和登录验证；
5. 再切换流量。

一旦发生永久账号删除或毕业账号清理，只有删除前数据库和头像备份能恢复凭据及自定义头像。

## 11. 上线检查清单

- [ ] `.env` 权限为 `600`，没有示例密码和示例密钥
- [ ] PostgreSQL 5432、Next.js 3000 未暴露公网
- [ ] `TRUSTED_PROXY_HOPS` 与真实代理链一致
- [ ] `npm run verify`、`npm run build` 通过
- [ ] `npx prisma migrate status` 正常
- [ ] `npm run remediation:readiness` 返回 `ready: true`
- [ ] PM2 已执行 `pm2 save` 并配置开机启动
- [ ] HTTPS、登录、首次强制改密正常
- [ ] `public/uploads/avatars` 可写且已纳入备份
- [ ] 两个 cron 可调用，失败会告警
- [ ] 数据库与头像恢复演练通过
- [ ] 已监控 PM2/Nginx/PostgreSQL 日志、磁盘和备份年龄

## 官方参考

- [Next.js 自托管](https://nextjs.org/docs/app/guides/self-hosting)
- [Prisma `migrate deploy`](https://www.prisma.io/docs/cli/migrate/deploy)
- [PM2 启动与开机恢复](https://pm2.keymetrics.io/docs/usage/startup/)
- [Nginx 反向代理](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy)
