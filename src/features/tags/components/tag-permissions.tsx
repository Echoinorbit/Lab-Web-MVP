import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

export function TagPermissions({ permissions }: { permissions: readonly string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">权限</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-1 text-sm">
          {permissions.map((permission) => (
            <li key={permission} className="rounded bg-muted px-2 py-1 font-mono text-xs">
              {permission}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
