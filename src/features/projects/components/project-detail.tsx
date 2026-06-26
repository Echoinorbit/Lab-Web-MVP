import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

import { ArchiveProjectButton } from "./archive-project-button";
import { ProjectArchiveCountdown } from "./project-archive-countdown";
import { ProjectMemberForm, type ProjectMemberOption } from "./project-member-form";
import { ProjectNodeViews } from "./project-node-views";
import { ProjectNodeForm, type ProjectNodeOption } from "./project-node-form";
import type { ProjectCanvasSourceNode } from "../lib/node-canvas";

export type ProjectMemberRow = {
  id: string;
  displayName: string;
  username: string;
};

export function ProjectDetail({
  id,
  name,
  status,
  description,
  viewerId,
  canvasNodes,
  members,
  availableUsers,
  parentOptions,
  canManageMembers,
  canCreateNode,
  canArchive,
  archivedAt,
}: {
  id: string;
  name: string;
  status: string;
  description?: string;
  viewerId: string;
  canvasNodes: readonly ProjectCanvasSourceNode[];
  members: readonly ProjectMemberRow[];
  availableUsers: readonly ProjectMemberOption[];
  parentOptions: readonly ProjectNodeOption[];
  canManageMembers: boolean;
  canCreateNode: boolean;
  canArchive: boolean;
  archivedAt?: string | null;
}) {
  const isArchived = status === "ARCHIVED";
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle>{name}</CardTitle>
              {isArchived && archivedAt ? <ProjectArchiveCountdown archivedAt={archivedAt} /> : null}
            </div>
            <Badge>{status}</Badge>
          </div>
        </CardHeader>
        {description ? <CardContent className="text-sm text-muted-foreground">{description}</CardContent> : null}
      </Card>
      {canArchive ? <ArchiveProjectButton projectId={id} status={status} archivedAt={archivedAt} /> : null}
      <ProjectNodeViews
        viewerId={viewerId}
        canvasNodes={canvasNodes}
        canManageNodeActions={!isArchived}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">成员</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 text-sm">
              {members.map((member) => (
                <Badge key={member.id} className="bg-muted">
                  {member.displayName} ({member.username})
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          {canManageMembers && !isArchived ? <ProjectMemberForm projectId={id} users={availableUsers} /> : null}
          {canCreateNode && !isArchived ? <ProjectNodeForm projectId={id} parentOptions={parentOptions} /> : null}
        </div>
      </div>
    </div>
  );
}
