import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ProjectForm } from "@/features/projects";
import { requirePermission } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { ADVISOR_TAG_NAME } from "@/shared/lib/system-tags";

export default async function NewProjectPage() {
  await requirePermission({ permission: PERMISSIONS.PROJECT_CREATE, entityType: "Project" });
  const now = new Date();
  const [users, advisors] = await Promise.all([
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

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>创建项目</CardTitle>
      </CardHeader>
      <CardContent>
        <ProjectForm users={users} advisors={advisors} />
      </CardContent>
    </Card>
  );
}
