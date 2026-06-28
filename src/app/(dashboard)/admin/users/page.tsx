import { ADMIN_USERS_PAGE_SIZE, ExcelImport, UserCreateForm, UserTable } from "@/features/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Pagination } from "@/shared/components/ui/pagination";
import { requirePermission } from "@/shared/lib/authorization";
import { formatComputedGrade, resolveGradeTrackFromTagNames } from "@/shared/lib/grade";
import { getPaginationState, parsePageParam } from "@/shared/lib/pagination";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePermission({ permission: PERMISSIONS.ADMIN_USER_MANAGE, entityType: "AdminUsers" });
  const now = new Date();
  const requestedPage = parsePageParam((await searchParams).page);
  const [totalUsers, advisors] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        tags: {
          some: {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            tag: { name: "advisor" },
          },
        },
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
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">用户管理</h1>
          <p className="text-sm text-muted-foreground">共 {totalUsers} 个用户，每页显示 {ADMIN_USERS_PAGE_SIZE} 个。</p>
        </div>
        <p className="text-sm text-muted-foreground">
          当前显示 {firstVisibleUser}–{lastVisibleUser}
        </p>
      </header>

      <section aria-label="用户列表" className="space-y-3">
        <UserTable
          users={users.map((user) => {
            const globalTagNames = user.tags.filter((userTag) => !userTag.projectId).map((userTag) => userTag.tag.name);
            return {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              studentId: user.studentId,
              role: user.role,
              status: user.status,
              computedGrade: formatComputedGrade(
                {
                  grade: user.grade,
                  enrollmentDate: user.enrollmentDate,
                  tagNames: globalTagNames,
                },
                now,
              ),
              gradeTrack: resolveGradeTrackFromTagNames(globalTagNames),
              advisorId: user.advisorId,
              isAdvisor: globalTagNames.includes("advisor"),
              tags: user.tags.map((userTag) => ({
                name: userTag.tag.name,
                displayName: userTag.tag.displayName,
                projectName: userTag.projectId ? userTag.project?.name ?? "未知项目" : null,
              })),
            };
          })}
          advisors={advisorOptions}
        />
        <Pagination
          basePath="/admin/users"
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
        />
      </section>

      <section aria-label="用户开通工具" className="grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">创建成员</CardTitle>
          </CardHeader>
          <CardContent>
            <UserCreateForm advisors={advisorOptions} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">批量导入成员</CardTitle>
          </CardHeader>
          <CardContent>
            <ExcelImport />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
