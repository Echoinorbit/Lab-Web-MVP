import Link from "next/link";

import { TagBadge } from "@/features/tags";
import { buttonStyles } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { formatComputedGrade } from "@/shared/lib/grade";
import { getEffectiveTags } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";

const roleLabels: Record<"ADMIN" | "MEMBER", string> = {
  ADMIN: "管理员",
  MEMBER: "成员",
};

async function resolveTagDisplayNames(names: string[]) {
  const map = new Map<string, string>();
  const unique = [...new Set(names)];
  if (unique.length === 0) return map;
  const tags = await prisma.tag.findMany({
    where: { name: { in: unique } },
    select: { name: true, displayName: true },
  });
  for (const tag of tags) map.set(tag.name, tag.displayName);
  return map;
}

export default async function ProfilePage() {
  const sessionUser = await requireActiveUser();

  const [profile, tags] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        displayName: true,
        username: true,
        role: true,
        studentId: true,
        grade: true,
        enrollmentDate: true,
        advisor: { select: { displayName: true } },
      },
    }),
    getEffectiveTags(sessionUser.id),
  ]);

  if (!profile) return null;

  const tagNames = tags.map((tag) => tag.name);
  const displayNameMap = await resolveTagDisplayNames(tagNames);
  const computedGrade = formatComputedGrade({
    grade: profile.grade,
    enrollmentDate: profile.enrollmentDate,
    tagNames,
  });

  const fields: Array<{ label: string; value: string }> = [
    { label: "姓名", value: profile.displayName },
    { label: "用户名", value: profile.username },
    { label: "角色", value: roleLabels[profile.role] },
    { label: "学号", value: profile.studentId ?? "—" },
    { label: "年级", value: computedGrade },
    { label: "导师", value: profile.advisor?.displayName ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      <PageHeader title="个人中心" description="查看当前身份、协作范围与账号安全入口。权限以有效 Tag 和账号状态为准。" />

      <section className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
        <div>
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground text-2xl font-semibold text-background">
            {profile.displayName.trim().charAt(0).toUpperCase() || "?"}
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{profile.displayName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">@{profile.username} · {roleLabels[profile.role]}</p>
        </div>

        <dl className="grid border-t border-border/80 sm:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="border-b border-border/80 py-5 sm:odd:pr-6 sm:even:pl-6">
              <dt className="text-sm text-muted-foreground">{field.label}</dt>
              <dd className="mt-1.5 text-[16px] font-medium">{field.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-5">
        <SectionHeader title="我的 Tag" description="Tag 决定内容能力与项目范围；已撤销或过期的 Tag 不会显示。" />
        <div className="border-t border-border/80 pt-6">
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <TagBadge
                  key={`${tag.name}-${tag.projectId ?? "global"}-${index}`}
                  name={tag.name}
                  displayName={displayNameMap.get(tag.name) ?? tag.name}
                />
              ))}
            </div>
          ) : (
            <EmptyState className="min-h-36 py-8" title="暂无有效 Tag" description="如需新的协作能力，请联系实验室管理员或项目负责人。" />
          )}
        </div>
      </section>

      <section className="space-y-5 border-t border-border/80 pt-8">
        <SectionHeader
          title="账号安全"
          description="定期更新密码；密码变更后继续使用新凭据登录。"
          actions={(
          <Link
            href="/change-password"
              className={buttonStyles({ variant: "secondary" })}
          >
            修改密码
          </Link>
          )}
        />
      </section>
    </div>
  );
}
