import { ProjectForm } from "@/features/projects";
import { hasGlobalAdvisorTag } from "@/features/projects/lib/visibility";
import { FORBIDDEN_ROUTE } from "@/shared/lib/access-denied";
import { getEffectiveTags, getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { ADVISOR_TAG_NAME } from "@/shared/lib/system-tags";
import { PageHeader } from "@/shared/components/ui/page-header";
import { redirect } from "next/navigation";

export default async function NewProjectPage() {
  const user = await requireActiveUser();
  const now = new Date();
  const [permissions, effectiveTags, advisors] = await Promise.all([
    getUserPermissions(user.id),
    getEffectiveTags(user.id),
    prisma.user.findMany({
      where: {
        role: "MEMBER",
        status: "ACTIVE",
        tags: {
          some: {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            tag: { name: ADVISOR_TAG_NAME },
          },
        },
      },
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
      select: {
        id: true,
        username: true,
        displayName: true,
        students: {
          where: { role: "MEMBER", status: "ACTIVE" },
          orderBy: [{ grade: "asc" }, { displayName: "asc" }],
          select: { id: true, username: true, displayName: true, grade: true, studentId: true },
        },
      },
    }),
  ]);
  const canCreate = permissions.has(PERMISSIONS.PROJECT_CREATE)
    || permissions.has(PERMISSIONS.PROJECT_CREATE_ON_BEHALF);
  if (!canCreate) redirect(FORBIDDEN_ROUTE);
  const creatorIsAdvisor = user.role === "MEMBER" && hasGlobalAdvisorTag({ tags: effectiveTags });
  const visibleAdvisors = creatorIsAdvisor ? advisors.filter((advisor) => advisor.id === user.id) : advisors;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="创建项目" description="选择负责导师、直属学生与项目组长。项目范围 Tag 将由系统流程自动维护。" />
      <div className="rounded-2xl border border-border/90 bg-card p-5 sm:p-7">
        <ProjectForm advisors={visibleAdvisors} lockedAdvisorId={creatorIsAdvisor ? user.id : undefined} />
      </div>
    </div>
  );
}
