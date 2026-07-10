import { AnnouncementForm } from "@/features/announcements";
import {
  ANNOUNCEMENT_CREATE_PERMISSION,
  ANNOUNCEMENT_ENTITY_TYPE,
} from "@/features/announcements/lib/access";
import { getProjectVisibilityWhere } from "@/features/projects/lib/visibility";
import { requirePermission } from "@/shared/lib/authorization";
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
    <div className="mx-auto max-w-3xl py-2">
      <AnnouncementForm projects={projects} />
    </div>
  );
}
