import { ExcelImport, UserCreateForm, UserTable } from "@/features/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { requirePermission } from "@/shared/lib/authorization";
import { formatComputedGrade, resolveGradeTrackFromTagNames } from "@/shared/lib/grade";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";

export default async function AdminUsersPage() {
  await requirePermission({ permission: PERMISSIONS.ADMIN_USER_MANAGE, entityType: "AdminUsers" });
  const now = new Date();
  const [users, advisors] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { username: "asc" }],
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
    }),
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

  const advisorOptions = advisors.map((advisor) => ({
    id: advisor.id,
    username: advisor.username,
    displayName: advisor.displayName,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
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
            tags: user.tags.map((userTag) =>
              userTag.projectId
                ? `${userTag.tag.displayName}@${userTag.project?.name ?? "未知项目"}`
                : userTag.tag.displayName,
            ),
          };
        })}
        advisors={advisorOptions}
      />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">创建成员</CardTitle>
          </CardHeader>
          <CardContent>
            <UserCreateForm advisors={advisorOptions} />
          </CardContent>
        </Card>
        <ExcelImport />
      </div>
    </div>
  );
}
