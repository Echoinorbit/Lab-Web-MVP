import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ProjectForm } from "@/features/projects";
import { hasGlobalAdvisorTag } from "@/features/projects/lib/visibility";
import { requirePermission } from "@/shared/lib/authorization";
import { getEffectiveTags, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { ADVISOR_TAG_NAME } from "@/shared/lib/system-tags";

export default async function NewProjectPage() {
  const user = await requirePermission({ permission: PERMISSIONS.PROJECT_CREATE, entityType: "Project" });
  const now = new Date();
  const [effectiveTags, users, advisors] = await Promise.all([
    getEffectiveTags(user.id),
    prisma.user.findMany({
      where: { role: "MEMBER", status: "ACTIVE" },
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
      select: { id: true, username: true, displayName: true },
    }),
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
      select: { id: true, username: true, displayName: true },
    }),
  ]);
  const creatorIsAdvisor = hasGlobalAdvisorTag({ tags: effectiveTags });
  const candidateUsers = creatorIsAdvisor ? users.filter((candidate) => candidate.id !== user.id) : users;

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>创建项目</CardTitle>
      </CardHeader>
      <CardContent>
        <ProjectForm users={candidateUsers} advisors={advisors} lockedAdvisorId={creatorIsAdvisor ? user.id : undefined} />
      </CardContent>
    </Card>
  );
}
