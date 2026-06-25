import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { requirePermission } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";

export default async function AdminPage() {
  await requirePermission({ permission: PERMISSIONS.ADMIN_DASHBOARD, entityType: "AdminDashboard" });

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {[
        ["用户管理", "账号创建、导入、停用、重置密码"],
        ["Tag 管理", "系统 Tag、项目级 Tag、审批和撤销"],
        ["操作日志记录", "敏感操作和越权尝试只追加留痕"],
      ].map(([title, body]) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle className="text-sm">{title}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{body}</CardContent>
        </Card>
      ))}
    </div>
  );
}
