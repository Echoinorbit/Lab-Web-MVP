import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ProjectForm } from "@/features/projects";
import { hasGlobalAdvisorTag } from "@/features/projects/lib/visibility";
import { FORBIDDEN_ROUTE } from "@/shared/lib/access-denied";
import { getEffectiveTags, getUserPermissions, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { ADVISOR_TAG_NAME } from "@/shared/lib/system-tags";
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
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>创建项目</CardTitle>
      </CardHeader>
      <CardContent className="pt-1">
        <ProjectForm advisors={visibleAdvisors} lockedAdvisorId={creatorIsAdvisor ? user.id : undefined} />
      </CardContent>
    </Card>
  );
}
