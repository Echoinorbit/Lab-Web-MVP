"use client";

import { ChevronDown, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DataTable } from "@/shared/components/data-table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { GRADE_LABELS, type GradeTrack } from "@/shared/lib/grade";

import { revokeUserSessions } from "../actions/revoke-user-sessions";
import { updateUserAdvisor } from "../actions/update-user-advisor";
import { updateUserGrade } from "../actions/update-user-grade";
import { updateUserIdentity } from "../actions/update-user-identity";
import { updateUserRole } from "../actions/update-user-role";
import { updateUserStatus } from "../actions/update-user-status";
import type { AdvisorOption } from "./user-create-form";

export type UserRow = {
  id: string;
  username: string;
  displayName: string;
  studentId: string | null;
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "SUSPENDED" | "GRADUATED";
  computedGrade: string;
  gradeTrack: GradeTrack | null;
  tags: Array<{
    name: string;
    displayName: string;
    projectName: string | null;
  }>;
  advisorId?: string | null;
  isAdvisor: boolean;
};

function UserGovernanceActions({
  user,
  advisors,
}: {
  user: UserRow;
  advisors: readonly AdvisorOption[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState(user.status);
  const [username, setUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [studentId, setStudentId] = useState(user.studentId ?? "");
  const [isPending, startTransition] = useTransition();
  const gradeOptions = user.gradeTrack ? GRADE_LABELS[user.gradeTrack] : [];
  const selectableGrade = (gradeOptions as readonly string[]).includes(user.computedGrade);

  function run(action: () => Promise<void>, onError?: () => void) {
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        onError?.();
        setMessage(error instanceof Error ? error.message : "操作失败");
      }
    });
  }

  return (
    <div className="grid min-w-72 gap-2">
      <details className="group rounded-lg border border-border/80 bg-card">
        <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium outline-none transition-colors duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          编辑用户
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-2 border-t border-border/70 p-3">
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">用户名</span>
            <Input className="h-8" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">姓名</span>
            <Input className="h-8" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="text-muted-foreground">学号</span>
            <Input className="h-8" value={studentId} onChange={(event) => setStudentId(event.target.value)} />
          </label>
          <Button
            type="button"
            variant="secondary"
            className="h-8 w-fit px-2"
            disabled={isPending || !username.trim() || !displayName.trim()}
            onClick={() => run(() => updateUserIdentity({
              userId: user.id,
              username,
              displayName,
              studentId,
            }))}
          >
            保存身份信息
          </Button>
          <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
            <select
              aria-label={`${user.displayName}的状态`}
              className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-60"
              value={selectedStatus}
              onChange={(event) => {
                const nextStatus = event.target.value as UserRow["status"];
                if (
                  nextStatus === "GRADUATED"
                  && !window.confirm("毕业操作不可撤销，将立即吊销会话并撤销该用户全部有效 Tag。确认继续？")
                ) {
                  setSelectedStatus(user.status);
                  return;
                }
                setSelectedStatus(nextStatus);
                run(
                  () => updateUserStatus({ userId: user.id, status: nextStatus }),
                  () => setSelectedStatus(user.status),
                );
              }}
              disabled={isPending || user.status === "GRADUATED"}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="GRADUATED">GRADUATED</option>
            </select>
            <select
              aria-label={`${user.displayName}的角色`}
              className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-60"
              defaultValue={user.role}
              onChange={(event) => run(() => updateUserRole({ userId: user.id, role: event.target.value }))}
              disabled={isPending}
            >
              <option value="MEMBER">MEMBER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <select
              aria-label={`${user.displayName}的年级`}
              className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-60"
              defaultValue={selectableGrade ? user.computedGrade : ""}
              onChange={(event) => run(() => updateUserGrade({ userId: user.id, grade: event.target.value }))}
              disabled={isPending || user.status === "GRADUATED" || !user.gradeTrack}
            >
              <option value="" disabled>
                {user.gradeTrack ? user.computedGrade : "年级不可直接选择"}
              </option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
            {user.role === "MEMBER" && !user.isAdvisor ? (
              <select
                aria-label={`${user.displayName}的导师`}
                className="h-8 rounded-lg border border-input bg-card px-2 text-xs outline-none transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-60"
                defaultValue={user.advisorId ?? ""}
                onChange={(event) => run(() => updateUserAdvisor({ userId: user.id, advisorId: event.target.value || null }))}
                disabled={isPending}
              >
                <option value="">无导师</option>
                {advisors.map((advisor) => (
                  <option key={advisor.id} value={advisor.id}>
                    {advisor.displayName}
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="h-8 px-2"
              onClick={() => run(() => revokeUserSessions({ userId: user.id }))}
              disabled={isPending}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              吊销
            </Button>
          </div>
          {message ? <span className="text-xs text-destructive">{message}</span> : null}
        </div>
      </details>
    </div>
  );
}

export function UserTable({
  users,
  advisors,
}: {
  users: readonly UserRow[];
  advisors: readonly AdvisorOption[];
}) {
  return (
    <DataTable
      rows={users}
      columns={[
        { key: "username", header: "用户名", cell: (row) => <span className="whitespace-nowrap font-mono text-xs">{row.username}</span> },
        { key: "name", header: "姓名", cell: (row) => <span className="whitespace-nowrap">{row.displayName}</span> },
        { key: "studentId", header: "学号", cell: (row) => <span className="whitespace-nowrap">{row.studentId ?? "-"}</span> },
        { key: "role", header: "角色", cell: (row) => <Badge>{row.role}</Badge> },
        { key: "status", header: "状态", cell: (row) => <Badge>{row.status}</Badge> },
        { key: "grade", header: "年级", cell: (row) => <Badge className="bg-muted">{row.computedGrade}</Badge> },
        {
          key: "tags",
          header: "Tag",
          cell: (row) => row.tags.length > 0
            ? (
                <div className="flex min-w-48 flex-wrap gap-1">
                  {row.tags.map((tag) => (
                    <Badge
                      key={tag.name}
                      className={tag.projectName ? "bg-secondary" : "bg-muted"}
                      title={tag.projectName ? `所属项目：${tag.projectName}` : undefined}
                    >
                      {tag.displayName}
                      {tag.projectName ? <span className="sr-only">，所属项目：{tag.projectName}</span> : null}
                    </Badge>
                  ))}
                </div>
              )
            : "-",
        },
        { key: "actions", header: "治理", cell: (row) => <UserGovernanceActions user={row} advisors={advisors} /> },
      ]}
    />
  );
}
