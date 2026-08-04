import { ArrowUpRight, Settings, ShieldCheck, Tags, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/shared/components/ui/page-header";
import { requirePermission } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";

const governanceAreas = [
  { href: "/admin/users", title: "用户", description: "创建、导入和维护成员身份、学籍与账号状态。", icon: Users },
  { href: "/admin/tags", title: "Tag", description: "查看能力模板，并授予或撤销有效协作范围。", icon: Tags },
  { href: "/admin/audit", title: "操作日志", description: "审阅敏感操作、越权尝试与周期归档。", icon: ShieldCheck },
  { href: "/admin/settings", title: "系统设置", description: "查看实验室协作平台的基础运行配置。", icon: Settings },
] as const;

export default async function AdminPage() {
  await requirePermission({ permission: PERMISSIONS.ADMIN_DASHBOARD, entityType: "AdminDashboard" });

  return (
    <div className="space-y-10">
      <PageHeader title="系统治理" description="集中管理身份、能力边界、系统记录与基础配置。所有敏感操作均由服务端鉴权并写入审计。" />
      <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
        {governanceAreas.map((area) => (
          <Link
            key={area.href}
            href={area.href}
            className="group grid min-h-32 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 border-b border-border/65 p-5 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] last:border-b-0 hover:bg-primary/[0.035] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-7 sm:p-7"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-foreground">
              <area.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-[-0.03em]">{area.title}</h2>
              <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{area.description}</p>
            </div>
            <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] group-hover:text-primary" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
