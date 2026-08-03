import { ChevronLeft, Users } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/shared/components/ui/badge";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { PageHeader, SectionHeader } from "@/shared/components/ui/page-header";
import { StatusNotice } from "@/shared/components/ui/status-notice";
import type { ActorSnapshotV1 } from "@/shared/lib/actor-snapshot";

import type { ProjectCanvasSourceNode } from "../lib/node-canvas";
import { ArchiveProjectButton } from "./archive-project-button";
import type { ProjectAdvisorOption } from "./advisor-student-tree";
import { ProjectArchiveCountdown } from "./project-archive-countdown";
import { ProjectEditForm } from "./project-edit-form";
import { ProjectLifecycleActions } from "./project-lifecycle-actions";
import { ProjectLeaderReassignmentForm } from "./project-leader-reassignment-form";
import { ProjectMemberForm } from "./project-member-form";
import { ProjectNodeForm, type ProjectNodeOption } from "./project-node-form";
import { ProjectNodeViews } from "./project-node-views";

export type ProjectMemberRow = {
  id: string;
  displayName: string;
  username: string | null;
};

type ProjectAttribution = {
  displayName: string;
  accountState: ActorSnapshotV1["accountState"];
};

const statusLabels: Record<string, string> = {
  PLANNING: "规划中",
  IN_PROGRESS: "进行中",
  REVIEW: "评审中",
  COMPLETED: "已完成",
  ARCHIVED: "已归档",
};

const accountStateLabels: Record<ActorSnapshotV1["accountState"], string> = {
  ACTIVE: "账号正常",
  SUSPENDED: "账号已停用",
  GRADUATED: "已毕业",
  DELETED: "账号已删除",
};

export function ProjectDetail({
  id,
  name,
  status,
  description,
  viewerId,
  creator,
  advisor,
  leader,
  canvasNodes,
  members,
  availableAdvisor,
  leaderCandidates,
  parentOptions,
  leaderNeedsReassignment,
  canReassignLeader,
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
  creator: ProjectAttribution;
  advisor: ProjectAttribution;
  leader: ProjectAttribution;
  canvasNodes: readonly ProjectCanvasSourceNode[];
  members: readonly ProjectMemberRow[];
  availableAdvisor?: ProjectAdvisorOption;
  leaderCandidates: ProjectAdvisorOption["students"];
  parentOptions: readonly ProjectNodeOption[];
  leaderNeedsReassignment: boolean;
  canReassignLeader: boolean;
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
  const hasProjectTools = canReassignLeader || canEdit || (canManageMembers && !isArchived) || (canCreateNode && !isArchived);
  const attributions = [
    ["创建人", creator],
    ["负责导师", advisor],
    ["项目负责人", leader],
  ] as const;

  return (
    <div className="space-y-10">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        返回项目
      </Link>

      <PageHeader
        title={name}
        description={description || "该项目尚未填写简介。"}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={isDeleted ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/10 text-primary"}>
              {isDeleted ? "已软删除" : statusLabels[status] ?? status}
            </Badge>
            {isArchived && archivedAt ? <ProjectArchiveCountdown archivedAt={archivedAt} /> : null}
          </div>
        )}
      />

      <section className="space-y-5" aria-label="项目归属" data-project-attribution>
        <SectionHeader title="项目归属" description="账号状态变化后仍保留项目创建与责任关系的历史署名。" />
        <dl className="grid overflow-hidden rounded-3xl border border-white/60 bg-card shadow-[var(--shadow-surface)] dark:border-border/80 sm:grid-cols-3">
          {attributions.map(([label, actor]) => (
            <div key={label} className="min-w-0 border-b border-border/75 px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="mt-1.5 break-words text-sm font-semibold text-foreground">{actor.displayName}</dd>
              <dd className="mt-2 text-xs text-muted-foreground">{accountStateLabels[actor.accountState]}</dd>
            </div>
          ))}
        </dl>
      </section>

      {leaderNeedsReassignment ? (
        <StatusNotice variant="warning" title="项目负责人待重新分配">
          {canReassignLeader
            ? "原负责人已不再符合任职条件。请从负责导师的直属在读硕博成员中指定新的负责人。"
            : "原负责人已不再符合任职条件，负责人专属的成员与节点管理能力已暂停；请联系负责导师或管理员处理。"}
        </StatusNotice>
      ) : null}

      {canArchive || canSoftDelete || canRestore || canHardDelete ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-border/80 pb-6">
          <span className="mr-auto text-sm text-muted-foreground">项目生命周期</span>
          {canArchive ? <ArchiveProjectButton projectId={id} status={status} archivedAt={archivedAt} /> : null}
          <ProjectLifecycleActions projectId={id} canSoftDelete={canSoftDelete} canRestore={canRestore} canHardDelete={canHardDelete} />
        </div>
      ) : null}

      {!isDeleted ? (
        <ProjectNodeViews viewerId={viewerId} canvasNodes={canvasNodes} canManageNodeActions={!isArchived} />
      ) : (
        <EmptyState title="项目已软删除" description="节点图与编辑工具已隐藏。管理员可以恢复项目或执行永久删除。" />
      )}

      <section className="space-y-5 border-t border-border/80 pt-8">
        <SectionHeader title="项目成员" description={`${members.length} 位成员在当前项目范围内协作。`} />
        {members.length > 0 ? (
          <ul className="grid overflow-hidden rounded-3xl border border-white/60 bg-card shadow-[var(--shadow-surface)] dark:border-border/80 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 border-b border-r border-border/75 px-5 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {member.displayName.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{member.displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.username ? `@${member.username}` : "历史成员"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Users className="h-5 w-5" aria-hidden="true" />} title="暂无项目成员" description="有管理权限的成员可以从负责导师的直属学生中邀请。" />
        )}
      </section>

      {hasProjectTools && !isDeleted ? (
        <section className="space-y-5 border-t border-border/80 pt-8">
          <SectionHeader title="项目工具" description="编辑项目信息、成员与节点；归档项目保持只读。" />
          <div className="grid items-start gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            {canReassignLeader ? <ProjectLeaderReassignmentForm projectId={id} candidates={leaderCandidates} /> : null}
            {canEdit ? <ProjectEditForm projectId={id} name={name} description={description} /> : null}
            {canManageMembers && !isArchived ? <ProjectMemberForm projectId={id} advisor={availableAdvisor} /> : null}
            {canCreateNode && !isArchived ? <ProjectNodeForm projectId={id} parentOptions={parentOptions} /> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
