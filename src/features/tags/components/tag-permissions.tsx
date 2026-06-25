import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import type { Permission } from "@/shared/lib/permissions";
import { describePermission } from "@/shared/lib/permissions";

export type TagPermissionGroup = {
  name: string;
  displayName: string;
  permissions: readonly Permission[];
};

export function TagPermissions({ groups }: { groups: readonly TagPermissionGroup[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">权限</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.map((group) => (
          <section key={group.name} className="space-y-2">
            <div>
              <div className="text-sm font-medium">{group.displayName}</div>
              <div className="font-mono text-xs text-muted-foreground">{group.name}</div>
            </div>
            {group.permissions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {group.permissions.map((permission) => (
                  <Badge key={permission} className="bg-muted text-foreground">
                    {describePermission(permission)}
                    <span className="ml-1 font-mono text-[11px] text-muted-foreground">{permission}</span>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">不授予额外权限。</p>
            )}
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
