import { TagGrantForm, TagList, TagPermissions } from "@/features/tags";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { StatusNotice } from "@/shared/components/ui/status-notice";
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
    <div className="space-y-10">
      <PageHeader title="Tag" description="Tag 为 MEMBER 账号授予内容能力或业务范围；管理员角色本身只负责治理。" />
      <StatusNotice title="管理边界">此页只管理 GLOBAL Tag。项目组长与组员 Tag 由项目流程自动维护，不可手动增删。</StatusNotice>

      <div className="grid min-w-0 items-start gap-10 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-12">
        <section className="min-w-0 space-y-5">
          <SectionHeader title="全局 Tag 清单" description={`${tags.length} 个全局 Tag 及其实时有效持有人数量。`} />
          <TagList
            tags={tags.map((tag) => ({
              name: tag.name,
              displayName: tag.displayName,
              scope: tag.scope,
              holderCount: tag._count.userTags,
            }))}
          />
        </section>

        <aside className="min-w-0 xl:sticky xl:top-24">
          <TagGrantForm
            users={users}
            tags={tags
              .filter((tag) => tag.scope === "GLOBAL" && tag.name !== "graduated")
              .map((tag) => ({ id: tag.id, name: tag.name, displayName: tag.displayName }))}
            userTags={userTags
              .filter((userTag) => userTag.tag.name !== "graduated")
              .map((userTag) => ({
                id: userTag.id,
                label: `${userTag.user.displayName} (${userTag.user.username}) → ${userTag.tag.displayName} (${userTag.tag.name})`,
              }))}
          />
        </aside>
      </div>

      <section className="space-y-5 border-t border-border/80 pt-8">
        <SectionHeader title="权限映射" description="显示每个 Tag 当前解析出的能力，空权限数组表示不授予额外能力。" />
        <TagPermissions
          groups={tags.map((tag) => ({
            name: tag.name,
            displayName: tag.displayName,
            permissions: normalizePermissionList(
              Array.isArray(tag.permissions) ? tag.permissions : tag.template?.permissions,
            ),
          }))}
        />
      </section>
    </div>
  );
}
