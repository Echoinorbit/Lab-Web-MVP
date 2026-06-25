import { Badge } from "@/shared/components/ui/badge";

export function TagBadge({ name, displayName }: { name: string; displayName: string }) {
  const isProject = name.startsWith("project-");
  return <Badge className={isProject ? "bg-secondary" : "bg-muted"}>{displayName}</Badge>;
}
