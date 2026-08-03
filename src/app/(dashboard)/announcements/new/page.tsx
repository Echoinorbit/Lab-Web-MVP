import { AnnouncementForm } from "@/features/announcements";
import {
  ANNOUNCEMENT_CREATE_PERMISSION,
  ANNOUNCEMENT_ENTITY_TYPE,
} from "@/features/announcements/lib/access";
import { getProjectVisibilityWhere } from "@/features/projects/lib/visibility";
import { requirePermission } from "@/shared/lib/authorization";
import { Card, CardContent } from "@/shared/components/ui/card";
import { PageHeader } from "@/shared/components/ui/page-header";
import { getEffectiveTags } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";

export default async function NewAnnouncementPage() {
  const user = await requirePermission({
    permission: ANNOUNCEMENT_CREATE_PERMISSION,
    entityType: ANNOUNCEMENT_ENTITY_TYPE,
  });
  const effectiveTags = await getEffectiveTags(user.id);
  const projects = await prisma.project.findMany({
    where: getProjectVisibilityWhere({ id: user.id, role: user.role, tags: effectiveTags }),
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="发布公告" description="填写内容与通知范围。全员公告不会携带底层目标 ID，定向公告必须选择明确受众。" />
      <Card>
        <CardContent>
          <AnnouncementForm projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
