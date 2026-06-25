import { Bell } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";

export function NotificationBadge({ count }: { count: number }) {
  return (
    <div className="relative inline-flex">
      <Bell className="h-5 w-5" />
      {count > 0 ? <Badge className="absolute -right-3 -top-3 bg-destructive text-destructive-foreground">{count}</Badge> : null}
    </div>
  );
}
