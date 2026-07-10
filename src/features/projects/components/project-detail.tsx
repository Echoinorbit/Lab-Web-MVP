import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

import { ArchiveProjectButton } from "./archive-project-button";
import { ProjectArchiveCountdown } from "./project-archive-countdown";
import { ProjectMemberForm } from "./project-member-form";
import type { ProjectAdvisorOption } from "./advisor-student-tree";
import { ProjectEditForm } from "./project-edit-form";
import { ProjectLifecycleActions } from "./project-lifecycle-actions";
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
  availableAdvisor,
  parentOptions,
  canManageMembers,
  canCreateNode,
  canArchive,
  canEdit,
  canSoftDelete,
  canRestore,
  canHardDelete,
  archivedAt,
  deletedAt,
}: {
  id: string;
  name: string;
  status: string;
  description?: string;
  viewerId: string;
  canvasNodes: readonly ProjectCanvasSourceNode[];
  members: readonly ProjectMemberRow[];
  availableAdvisor?: ProjectAdvisorOption;
  parentOptions: readonly ProjectNodeOption[];
  canManageMembers: boolean;
  canCreateNode: boolean;
  canArchive: boolean;
  canEdit: boolean;
  canSoftDelete: boolean;
  canRestore: boolean;
  canHardDelete: boolean;
  archivedAt?: string | null;
  deletedAt?: string | null;
}) {
  const isArchived = status === "ARCHIVED";
  const isDeleted = Boolean(deletedAt);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="px-6 py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-xl tracking-[-0.025em]">{name}</CardTitle>
              {isArchived && archivedAt ? <ProjectArchiveCountdown archivedAt={archivedAt} /> : null}
              {isDeleted ? <Badge className="bg-destructive text-destructive-foreground">已软删除</Badge> : null}
            </div>
            <Badge>{status}</Badge>
          </div>
        </CardHeader>
        {description ? <CardContent className="max-w-[75ch] px-6 py-5 text-sm leading-7 text-muted-foreground">{description}</CardContent> : null}
      </Card>
      <div className="flex flex-wrap gap-3">
        {canArchive ? <ArchiveProjectButton projectId={id} status={status} archivedAt={archivedAt} /> : null}
        <ProjectLifecycleActions projectId={id} canSoftDelete={canSoftDelete} canRestore={canRestore} canHardDelete={canHardDelete} />
      </div>
      {!isDeleted ? (
        <ProjectNodeViews viewerId={viewerId} canvasNodes={canvasNodes} canManageNodeActions={!isArchived} />
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
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
        <div className="space-y-6">
          {canEdit ? <ProjectEditForm projectId={id} name={name} description={description} /> : null}
          {canManageMembers && !isArchived ? <ProjectMemberForm projectId={id} advisor={availableAdvisor} /> : null}
          {canCreateNode && !isArchived ? <ProjectNodeForm projectId={id} parentOptions={parentOptions} /> : null}
        </div>
      </div>
    </div>
  );
}
