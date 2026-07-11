import { ADMIN_USERS_PAGE_SIZE, ExcelImport, UserCreateForm, UserTable } from "@/features/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { requirePermission } from "@/shared/lib/authorization";
import { getPaginationState, parsePageParam } from "@/shared/lib/pagination";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { formatStudyGrade } from "@/shared/lib/study-identity";

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
    <div className="min-w-0 space-y-10">
      <PageHeader
        title="用户"
        description={`共 ${totalUsers} 个账号。当前显示 ${firstVisibleUser}–${lastVisibleUser}，每页 ${ADMIN_USERS_PAGE_SIZE} 个。`}
      />

      <section aria-label="用户列表" className="min-w-0 space-y-5">
        <SectionHeader title="账号与身份" description="在表格内维护身份、角色、状态、年级、导师与会话。毕业操作不可撤销。" />
        <UserTable
          users={users.map((user) => {
            return {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              studentId: user.studentId,
              role: user.role,
              status: user.status,
              computedGrade: formatStudyGrade(user.studyDegree, user.studyGrade),
              gradeTrack: user.studyDegree === "MASTER" ? "master" : user.studyDegree === "DOCTOR" ? "phd" : null,
              advisorId: user.advisorId,
              isAdvisor: user.studyDegree === "MENTOR" && !user.identityNeedsReview,
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

      <section aria-label="用户开通工具" className="space-y-5 border-t border-border/80 pt-8">
        <SectionHeader title="开通成员" description="可以单个创建账号，或使用固定列顺序的 Excel 模板批量导入。" />
        <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>创建成员</CardTitle>
          </CardHeader>
          <CardContent>
            <UserCreateForm advisors={advisorOptions} />
          </CardContent>
        </Card>
        <Card>
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
