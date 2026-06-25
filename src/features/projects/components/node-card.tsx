import { CircleAlert, Flag, GitCommitHorizontal, Lightbulb, Paperclip } from "lucide-react";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

import { ProjectNodeActions } from "./project-node-actions";
import { resolveAuthorColor } from "../lib/author-color";

const nodeMeta = {
  MILESTONE: { label: "里程碑", icon: Flag, className: "bg-primary text-primary-foreground" },
  UPDATE: { label: "更新", icon: GitCommitHorizontal, className: "bg-muted" },
  DECISION: { label: "决策", icon: Lightbulb, className: "bg-secondary" },
  ISSUE: { label: "问题", icon: CircleAlert, className: "bg-destructive text-destructive-foreground" },
  RESOURCE: { label: "资源", icon: Paperclip, className: "bg-muted" },
} as const;

export type TimelineNode = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  nodeType: keyof typeof nodeMeta;
  authorId: string;
  authorName: string;
  colorHex?: string | null;
  createdAt: string;
  children?: TimelineNode[];
};

export function NodeCard({
  node,
  viewerId,
  canManageNodeActions,
}: {
  node: TimelineNode;
  viewerId: string;
  canManageNodeActions: boolean;
}) {
  const meta = nodeMeta[node.nodeType];
  const Icon = meta.icon;
  const accentColor = resolveAuthorColor({ authorId: node.authorId, colorHex: node.colorHex });
  const canManageNode = canManageNodeActions && node.authorId === viewerId;
  return (
    <Card className="border-2" style={{ borderColor: accentColor }}>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={meta.className}>
            <Icon className="mr-1 h-3 w-3" />
            {meta.label}
          </Badge>
          <span
            className="h-2.5 w-2.5 rounded-full border border-card"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          />
          <span className="text-xs text-muted-foreground">
            {node.authorName} · {node.createdAt}
          </span>
        </div>
        <CardTitle className="text-sm">{node.title}</CardTitle>
      </CardHeader>
      {node.description ? <CardContent className="text-sm text-muted-foreground">{node.description}</CardContent> : null}
      {canManageNode ? (
        <CardContent className={node.description ? "border-t pt-3" : "pt-0"}>
          <ProjectNodeActions projectId={node.projectId} nodeId={node.id} />
        </CardContent>
      ) : null}
    </Card>
  );
}
