import type { Prisma } from "@prisma/client";
import Link from "next/link";

import { TagGrantForm, TagList, TagPermissions } from "@/features/tags";
import { isManuallyManageableTagName } from "@/features/tags/lib/project-tag-guard";
import { buttonStyles } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { Pagination } from "@/shared/components/ui/pagination";
import { StatusNotice } from "@/shared/components/ui/status-notice";
import { requirePermission } from "@/shared/lib/authorization";
import { getPaginationState, parsePageParam } from "@/shared/lib/pagination";
import { normalizePermissionList, PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";

const TAG_USER_PAGE_SIZE = 40;

export default async function AdminTagsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requirePermission({ permission: PERMISSIONS.ADMIN_TAG_MANAGE, entityType: "AdminTags" });
  const now = new Date();
  const query = await searchParams;
  const search = query.q?.trim().slice(0, 80) ?? "";
  const userWhere: Prisma.UserWhereInput = {
    role: "MEMBER",
    status: "ACTIVE",
    ...(search ? {
      OR: [
        { username: { contains: search, mode: "insensitive" } },
        { displayName: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
      ],
    } : {}),
  };
  const totalUsers = await prisma.user.count({ where: userWhere });
  const pagination = getPaginationState({
    page: parsePageParam(query.page),
    totalItems: totalUsers,
    pageSize: TAG_USER_PAGE_SIZE,
  });
  const [tags, users] = await Promise.all([
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
      where: userWhere,
      orderBy: { username: "asc" },
      skip: pagination.skip,
      take: pagination.pageSize,
      select: { id: true, username: true, displayName: true },
    }),
  ]);
  const userTags = users.length > 0
    ? await prisma.userTag.findMany({
      where: {
        userId: { in: users.map((user) => user.id) },
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        tag: { scope: "GLOBAL" },
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { username: true, displayName: true } },
        tag: { select: { name: true, displayName: true } },
      },
    })
    : [];

  return (
    <div className="space-y-10">
      <PageHeader title="Tag" description="Tag 为 MEMBER 账号授予内容能力或业务范围；管理员角色本身只负责治理。" />
      <StatusNotice title="管理边界">此页只管理 GLOBAL Tag。项目组长与组员 Tag 由项目流程自动维护，不可手动增删。</StatusNotice>

      <form action="/admin/tags" className="grid gap-3 rounded-2xl border border-border/90 bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">筛选成员与授权</span>
          <Input name="q" defaultValue={search} placeholder="用户名、姓名或学号" />
        </label>
        <button type="submit" className={buttonStyles()}>筛选</button>
        <Link href="/admin/tags" className={buttonStyles({ variant: "secondary" })}>重置</Link>
      </form>

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
              .filter((tag) => isManuallyManageableTagName(tag.name))
              .map((tag) => ({ id: tag.id, name: tag.name, displayName: tag.displayName }))}
            userTags={userTags
              .filter((userTag) => isManuallyManageableTagName(userTag.tag.name))
              .map((userTag) => ({
                id: userTag.id,
                label: `${userTag.user.displayName} (${userTag.user.username}) → ${userTag.tag.displayName} (${userTag.tag.name})`,
              }))}
          />
          <div className="mt-4">
            <Pagination
              basePath="/admin/tags"
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              params={{ q: search || undefined }}
            />
          </div>
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
