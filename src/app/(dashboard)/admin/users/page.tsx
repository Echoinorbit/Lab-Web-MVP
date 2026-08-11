import type { Prisma, UserStatus } from "@prisma/client";
import Link from "next/link";

import { ADMIN_USERS_PAGE_SIZE, ExcelImport, UserCreateForm, UserTable } from "@/features/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { buttonStyles } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { Select } from "@/shared/components/ui/select";
import { requirePermission } from "@/shared/lib/authorization";
import { getPaginationState, parsePageParam } from "@/shared/lib/pagination";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { formatStudyGrade } from "@/shared/lib/study-identity";

import styles from "./users.module.css";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  await requirePermission({ permission: PERMISSIONS.ADMIN_USER_MANAGE, entityType: "AdminUsers" });
  const now = new Date();
  const query = await searchParams;
  const requestedPage = parsePageParam(query.page);
  const search = query.q?.trim().slice(0, 80) ?? "";
  const status: UserStatus | "ALL" = query.status === "ACTIVE" || query.status === "SUSPENDED" || query.status === "GRADUATED"
    ? query.status
    : "ALL";
  const where: Prisma.UserWhereInput = {
    ...(status === "ALL" ? {} : { status }),
    ...(search ? {
      OR: [
        { username: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
      ],
    } : {}),
  };
  const [totalUsers, advisors] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        studyDegree: "MENTOR",
        identityNeedsReview: false,
      },
      orderBy: { displayName: "asc" },
      select: { id: true, username: true, displayName: true },
    }),
  ]);
  const pagination = getPaginationState({
    page: requestedPage,
    totalItems: totalUsers,
    pageSize: ADMIN_USERS_PAGE_SIZE,
  });
  const users = await prisma.user.findMany({
    where,
    orderBy: [{ role: "asc" }, { username: "asc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      tags: {
        where: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        select: {
          projectId: true,
          tag: { select: { name: true, displayName: true } },
          project: { select: { name: true } },
        },
      },
    },
  });

  const advisorOptions = advisors.map((advisor) => ({
    id: advisor.id,
    username: advisor.username,
    displayName: advisor.displayName,
  }));
  const firstVisibleUser = totalUsers === 0 ? 0 : pagination.skip + 1;
  const lastVisibleUser = Math.min(pagination.skip + users.length, totalUsers);

  return (
    <div className={styles.page}>
      <PageHeader
        title="用户治理"
        description={`找到 ${totalUsers} 个账号。当前显示 ${firstVisibleUser}–${lastVisibleUser}，每页 ${ADMIN_USERS_PAGE_SIZE} 个。`}
      />

      <section aria-label="用户列表" className={styles.registry}>
        <SectionHeader title="账号与身份" description="先筛选账号，再进入独立治理页面处理角色、培养身份、状态与删除。" />
        <form className={styles.queryPanel} action="/admin/users">
          <div className={styles.queryRail} aria-hidden="true">USER INDEX</div>
          <div className={styles.queryFields}>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">搜索用户</span>
              <Input name="q" defaultValue={search} placeholder="用户名、姓名或学号" />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">账号状态</span>
              <Select name="status" defaultValue={status}>
                <option value="ALL">全部状态</option>
                <option value="ACTIVE">在用</option>
                <option value="SUSPENDED">已暂停</option>
                <option value="GRADUATED">毕业清理期</option>
              </Select>
            </label>
          </div>
          <div className={styles.queryActions}>
            <button type="submit" className={buttonStyles({ className: styles.filterButton })}>筛选</button>
            <Link href="/admin/users" className={buttonStyles({ variant: "secondary" })}>重置</Link>
          </div>
        </form>
        <UserTable
          users={users.map((user) => {
            return {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatar: user.avatar,
              studentId: user.studentId,
              role: user.role,
              status: user.status,
              computedGrade: formatStudyGrade(user.studyDegree, user.studyGrade),
              identityNeedsReview: user.identityNeedsReview,
              scheduledDeletionAt: user.scheduledDeletionAt
                ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", year: "numeric" }).format(user.scheduledDeletionAt)
                : null,
              tags: user.tags.map((userTag) => ({
                name: userTag.tag.name,
                displayName: userTag.tag.displayName,
                projectName: userTag.projectId ? userTag.project?.name ?? "未知项目" : null,
              })),
            };
          })}
        />
        <Pagination
          basePath="/admin/users"
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          params={{ q: search || undefined, status: status === "ALL" ? undefined : status }}
        />
      </section>

      <section aria-label="用户开通工具" className={styles.provisioning}>
        <SectionHeader title="开通成员" description="可以单个创建账号，或使用固定列顺序的 Excel 模板批量导入。" />
        <div className={styles.provisionGrid}>
          <Card className={styles.provisionCard}>
            <CardHeader>
              <CardTitle>创建成员</CardTitle>
            </CardHeader>
            <CardContent>
              <UserCreateForm advisors={advisorOptions} />
            </CardContent>
          </Card>
          <Card className={styles.provisionCard}>
            <CardHeader>
              <CardTitle>批量导入成员</CardTitle>
            </CardHeader>
            <CardContent>
              <ExcelImport />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
