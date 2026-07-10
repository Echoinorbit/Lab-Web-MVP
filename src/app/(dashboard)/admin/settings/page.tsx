import { SettingsForm } from "@/features/admin";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { StatusNotice } from "@/shared/components/ui/status-notice";
import { requirePermission } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";

export default async function AdminSettingsPage() {
  await requirePermission({ permission: PERMISSIONS.ADMIN_SETTINGS, entityType: "SystemSettings" });

  return (
    <div className="space-y-10">
      <PageHeader title="系统设置" description="查看平台级运行参数。只有具备系统设置权限的管理员可以进入此页。" />
      <section className="max-w-3xl space-y-6">
        <SectionHeader title="基础参数" description="填写窗口和会话时长影响所有成员，应在明确变更策略后调整。" />
        <StatusNotice title="当前版本说明">设置页仍为 MVP 配置界面，保存尚未连接持久化配置。</StatusNotice>
        <div className="border-t border-border/80 pt-6">
          <SettingsForm />
        </div>
      </section>
    </div>
  );
}
