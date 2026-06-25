import Link from "next/link";

import { TagBadge } from "@/features/tags";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
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
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>个人中心</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label}>
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="mt-0.5 text-sm font-medium">{field.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>我的 Tag</CardTitle>
        </CardHeader>
        <CardContent>
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
            <p className="text-sm text-muted-foreground">暂无 Tag。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>账号安全</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href="/change-password"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            修改密码
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
