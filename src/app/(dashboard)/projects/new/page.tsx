import { ProjectForm } from "@/features/projects";
import { FORBIDDEN_ROUTE } from "@/shared/lib/access-denied";
import { getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { formatStudyGrade } from "@/shared/lib/study-identity";
import { PageHeader } from "@/shared/components/ui/page-header";
import { Card, CardContent } from "@/shared/components/ui/card";
import { redirect } from "next/navigation";

export default async function NewProjectPage() {
  const user = await requireActiveUser();
  const [permissions, advisors] = await Promise.all([
    getUserPermissions(user.id),
    prisma.user.findMany({
      where: {
        role: "MEMBER",
        status: "ACTIVE",
        studyDegree: "MENTOR",
        identityNeedsReview: false,
      },
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        displayName: true,
        students: {
          where: { role: "MEMBER", status: "ACTIVE" },
          orderBy: [{ displayName: "asc" }],
          select: { id: true, username: true, displayName: true, studyDegree: true, studyGrade: true, studentId: true },
        },
      },
    }),
  ]);
  const canCreate = permissions.has(PERMISSIONS.PROJECT_CREATE)
    || permissions.has(PERMISSIONS.PROJECT_CREATE_ON_BEHALF);
  if (!canCreate) redirect(FORBIDDEN_ROUTE);
  const creatorIsAdvisor = user.role === "MEMBER" && user.studyDegree === "MENTOR" && !user.identityNeedsReview;
  const visibleAdvisors = (creatorIsAdvisor ? advisors.filter((advisor) => advisor.id === user.id) : advisors).map((advisor) => ({
    ...advisor,
    students: advisor.students.map((student) => ({
      ...student,
      grade: formatStudyGrade(student.studyDegree, student.studyGrade),
    })),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="创建项目" description="选择负责导师、直属学生与项目组长。项目范围 Tag 将由系统流程自动维护。" />
      <Card>
        <CardContent>
          <ProjectForm advisors={visibleAdvisors} lockedAdvisorId={creatorIsAdvisor ? user.id : undefined} />
        </CardContent>
      </Card>
    </div>
  );
}
