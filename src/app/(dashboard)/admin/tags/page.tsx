import { TagGrantForm, TagList, TagPermissions } from "@/features/tags";
import { requirePermission } from "@/shared/lib/authorization";
import { normalizePermissionList, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";

export default async function AdminTagsPage() {
  await requirePermission({ permission: PERMISSIONS.ADMIN_TAG_MANAGE, entityType: "AdminTags" });
  const now = new Date();
  const [tags, users, userTags] = await Promise.all([
    prisma.tag.findMany({
      where: { scope: "GLOBAL" },
      orderBy: [{ scope: "asc" }, { name: "asc" }],
      include: {
        template: { select: { permissions: true } },
        _count: {
          select: {
            userTags: {
              where: {
                revokedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "MEMBER", status: "ACTIVE" },
      orderBy: { username: "asc" },
      select: { id: true, username: true, displayName: true },
    }),
    prisma.userTag.findMany({
      where: {
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        tag: { scope: "GLOBAL" },
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { username: true, displayName: true } },
        tag: { select: { name: true, displayName: true } },
      },
      take: 100,
    }),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-4">
        <p className="rounded-xl border bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">
          本页仅展示和管理 GLOBAL Tag；项目组长/组员 Tag 由项目流程自动维护，不可手动增删。
        </p>
        <TagList
          tags={tags.map((tag) => ({
            name: tag.name,
            displayName: tag.displayName,
            scope: tag.scope,
            holderCount: tag._count.userTags,
          }))}
        />
      </div>
      <div className="space-y-6">
        <TagGrantForm
          users={users}
          tags={tags
            .filter((tag) => tag.scope === "GLOBAL" && tag.name !== "graduated")
            .map((tag) => ({ id: tag.id, name: tag.name, displayName: tag.displayName }))}
          userTags={userTags
            .filter((userTag) => userTag.tag.name !== "graduated")
            .map((userTag) => ({
              id: userTag.id,
              label: `${userTag.user.displayName} (${userTag.user.username}) -> ${userTag.tag.displayName} (${userTag.tag.name})`,
            }))}
        />
        <TagPermissions
          groups={tags.map((tag) => ({
            name: tag.name,
            displayName: tag.displayName,
            permissions: normalizePermissionList(
              Array.isArray(tag.permissions) ? tag.permissions : tag.template?.permissions,
            ),
          }))}
        />
      </div>
    </div>
  );
}
