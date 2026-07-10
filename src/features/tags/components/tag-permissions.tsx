import { Badge } from "@/shared/components/ui/badge";
import { describePermission, type Permission } from "@/shared/lib/permissions";

export type TagPermissionGroup = {
  name: string;
  displayName: string;
  permissions: readonly Permission[];
};

export function TagPermissions({ groups }: { groups: readonly TagPermissionGroup[] }) {
  return (
    <div className="divide-y divide-border/75 overflow-hidden rounded-2xl border border-border/90 bg-card">
      {groups.map((group) => (
        <section key={group.name} className="grid gap-4 px-5 py-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:px-6">
          <div>
            <h3 className="text-sm font-semibold">{group.displayName}</h3>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{group.name}</p>
          </div>
          {group.permissions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {group.permissions.map((permission) => (
                <Badge key={permission} className="bg-muted text-foreground" title={permission}>
                  {describePermission(permission)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">不授予额外权限。</p>
          )}
        </section>
      ))}
    </div>
  );
}
