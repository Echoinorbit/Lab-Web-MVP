import { SettingsForm } from "@/features/admin";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { requirePermission } from "@/shared/lib/authorization";
import { formatShanghaiDate } from "@/shared/lib/date";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { prisma } from "@/shared/lib/prisma";

export default async function AdminSettingsPage() {
  await requirePermission({ permission: PERMISSIONS.ADMIN_SETTINGS, entityType: "SystemSettings" });
  const settings = await prisma.systemSetting.findUniqueOrThrow({
    where: { id: "singleton" },
    include: { updatedBy: { select: { displayName: true } } },
  });

  return (
    <div className="space-y-10">
      <PageHeader title="系统设置" description="平台级运行参数由数据库持久化，提交进度和新签发会话读取同一份配置。" />
      <section className="max-w-3xl space-y-6">
        <SectionHeader title="基础参数" description="填写窗口和会话时长影响所有成员，应在明确变更策略后调整。" />
        <div className="border-t border-border/80 pt-6">
          <SettingsForm settings={{
            revision: settings.revision,
            progressStartDay: settings.progressStartDay,
            progressStartMinute: settings.progressStartMinute,
            progressEndDay: settings.progressEndDay,
            progressEndMinute: settings.progressEndMinute,
            sessionHours: settings.sessionHours,
            updatedAt: formatShanghaiDate(settings.updatedAt),
            updatedBy: settings.updatedBy?.displayName ?? "系统初始化",
          }} />
        </div>
      </section>
    </div>
  );
}
