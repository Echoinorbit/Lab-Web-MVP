import Link from "next/link";

import { AvatarEditor } from "@/features/profile";
import { TagBadge } from "@/features/tags";
import { Avatar } from "@/shared/components/ui/avatar";
import { buttonStyles } from "@/shared/components/ui/button";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { getEffectiveTags } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";
import { requireActiveUser } from "@/shared/lib/session";
import { formatStudyGrade } from "@/shared/lib/study-identity";

import styles from "./profile.module.css";

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
        avatar: true,
        username: true,
        role: true,
        studentId: true,
        studyDegree: true,
        studyGrade: true,
        enrollmentDate: true,
        advisor: { select: { displayName: true } },
      },
    }),
    getEffectiveTags(sessionUser.id),
  ]);

  if (!profile) return null;

  const tagNames = tags.map((tag) => tag.name);
  const displayNameMap = await resolveTagDisplayNames(tagNames);
  const computedGrade = formatStudyGrade(profile.studyDegree, profile.studyGrade);

  const fields: Array<{ label: string; value: string }> = [
    { label: "姓名", value: profile.displayName },
    { label: "用户名", value: profile.username },
    { label: "角色", value: roleLabels[profile.role] },
    { label: "学号", value: profile.studentId ?? "—" },
    { label: "年级", value: computedGrade },
    { label: "导师", value: profile.advisor?.displayName ?? "—" },
  ];

  return (
    <div className={styles.page}>
      <PageHeader title="个人档案" description="查看当前身份、协作范围与账号安全入口。权限以有效 Tag 和账号状态为准。" />

      <section className={styles.identityStage} aria-labelledby="profile-identity-title">
        <div className={styles.identityRail} aria-hidden="true">PERSONNEL FILE</div>
        <div className={styles.identityCard}>
          <p className={styles.recordCode}>RECORD / 01</p>
          <Avatar className={styles.avatar} src={profile.avatar} name={profile.displayName} size={112} priority />
          <h2 id="profile-identity-title" className={styles.name}>{profile.displayName}</h2>
          <p className={styles.identityMeta}>@{profile.username} · {roleLabels[profile.role]}</p>
          <div className={styles.signalLine} aria-hidden="true" />
        </div>

        <dl className={styles.identityFields}>
          {fields.map((field) => (
            <div key={field.label} className={styles.field}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.module}>
        <SectionHeader title="头像" description="上传后先在浏览器内完成 1:1 裁剪，服务端会再次校验最终 PNG。" />
        <AvatarEditor currentAvatar={profile.avatar} displayName={profile.displayName} />
      </section>

      <section className={styles.module}>
        <SectionHeader title="我的 Tag" description="Tag 决定内容能力与项目范围；已撤销或过期的 Tag 不会显示。" />
        <div className={styles.capabilityGrid}>
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

      <section className={styles.module}>
        <SectionHeader
          title="账号安全"
          description="定期更新密码；密码变更后继续使用新凭据登录。"
          actions={(
            <Link href="/change-password" className={buttonStyles({ variant: "secondary" })}>
              修改密码
            </Link>
          )}
        />
      </section>
    </div>
  );
}
