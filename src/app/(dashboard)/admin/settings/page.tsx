import { SettingsForm } from "@/features/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { requirePermission } from "@/shared/lib/authorization";
import { PERMISSIONS } from "@/shared/lib/permissions";

export default async function AdminSettingsPage() {
  await requirePermission({ permission: PERMISSIONS.ADMIN_SETTINGS, entityType: "SystemSettings" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>系统设置</CardTitle>
      </CardHeader>
      <CardContent>
        <SettingsForm />
      </CardContent>
    </Card>
  );
}
