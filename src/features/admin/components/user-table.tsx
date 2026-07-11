import type { Route } from "next";
import Link from "next/link";

import { DataTable } from "@/shared/components/data-table";
import { Avatar } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { buttonStyles } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

export type UserRow = {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  studentId: string | null;
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "SUSPENDED" | "GRADUATED";
  computedGrade: string;
  identityNeedsReview: boolean;
  scheduledDeletionAt: string | null;
  tags: Array<{
    name: string;
    displayName: string;
    projectName: string | null;
  }>;
};

const roleLabels: Record<UserRow["role"], string> = {
  ADMIN: "管理员",
  MEMBER: "成员",
};

const statusLabels: Record<UserRow["status"], string> = {
  ACTIVE: "在用",
  SUSPENDED: "已暂停",
  GRADUATED: "毕业清理期",
};

export function UserTable({ users }: { users: readonly UserRow[] }) {
  return (
    <DataTable
      label="用户账号与治理状态"
      emptyMessage="没有符合筛选条件的用户"
      rows={users}
      columns={[
        {
          key: "identity",
          header: "用户",
          cell: (row) => (
            <div className="flex min-w-48 items-center gap-3">
              <Avatar src={row.avatar} name={row.displayName} size={36} />
              <div className="min-w-0">
                <div className="truncate font-medium">{row.displayName}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">{row.username}</div>
              </div>
            </div>
          ),
        },
        { key: "studentId", header: "学号", cell: (row) => <span className="whitespace-nowrap">{row.studentId ?? "-"}</span> },
        { key: "role", header: "角色", cell: (row) => <Badge>{roleLabels[row.role]}</Badge> },
        {
          key: "status",
          header: "状态",
          cell: (row) => (
            <div className="grid min-w-28 gap-1.5">
              <Badge
                className={cn(
                  "w-fit",
                  row.status === "ACTIVE" && "border-success/25 bg-success/10 text-success",
                  row.status === "GRADUATED" && "border-destructive/25 bg-destructive/10 text-destructive",
                )}
              >
                {statusLabels[row.status]}
              </Badge>
              {row.scheduledDeletionAt ? (
                <span className="text-xs text-muted-foreground">计划删除：{row.scheduledDeletionAt}</span>
              ) : null}
            </div>
          ),
        },
        {
          key: "grade",
          header: "培养身份",
          cell: (row) => (
            <div className="grid gap-1.5">
              <Badge className="w-fit bg-muted">{row.computedGrade}</Badge>
              {row.identityNeedsReview ? <span className="text-xs font-medium text-destructive">需要人工修复</span> : null}
            </div>
          ),
        },
        {
          key: "tags",
          header: "有效 Tag",
          cell: (row) => row.tags.length > 0
            ? (
                <div className="flex min-w-48 flex-wrap gap-1">
                  {row.tags.map((tag) => (
                    <Badge
                      key={`${tag.name}:${tag.projectName ?? "global"}`}
                      className={tag.projectName ? "bg-secondary" : "bg-muted"}
                      title={tag.projectName ? `所属项目：${tag.projectName}` : undefined}
                    >
                      {tag.displayName}
                      {tag.projectName ? <span className="sr-only">，所属项目：{tag.projectName}</span> : null}
                    </Badge>
                  ))}
                </div>
              )
            : <span className="text-muted-foreground">无</span>,
        },
        {
          key: "actions",
          header: "操作",
          cell: (row) => (
            <Link
              className={buttonStyles({ variant: "secondary", size: "small" })}
              href={`/admin/users/${row.id}/edit` as Route}
            >
              管理
            </Link>
          ),
        },
      ]}
    />
  );
}
