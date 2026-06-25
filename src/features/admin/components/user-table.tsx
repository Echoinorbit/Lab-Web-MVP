"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DataTable } from "@/shared/components/data-table";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { GRADE_LABELS, type GradeTrack } from "@/shared/lib/grade";

import { revokeUserSessions } from "../actions/revoke-user-sessions";
import { updateUserAdvisor } from "../actions/update-user-advisor";
import { updateUserGrade } from "../actions/update-user-grade";
import { updateUserRole } from "../actions/update-user-role";
import { updateUserStatus } from "../actions/update-user-status";
import type { AdvisorOption } from "./user-create-form";

export type UserRow = {
  id: string;
  username: string;
  displayName: string;
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "SUSPENDED" | "GRADUATED";
  computedGrade: string;
  gradeTrack: GradeTrack | null;
  tags: string[];
  advisorId?: string | null;
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
  const [isPending, startTransition] = useTransition();
  const gradeOptions = user.gradeTrack ? GRADE_LABELS[user.gradeTrack] : [];
  const selectableGrade = (gradeOptions as readonly string[]).includes(user.computedGrade);

  function run(action: () => Promise<void>) {
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "操作失败");
      }
    });
  }

  return (
    <div className="grid min-w-64 gap-2">
      <div className="flex flex-wrap gap-2">
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          defaultValue={user.status}
          onChange={(event) => run(() => updateUserStatus({ userId: user.id, status: event.target.value }))}
          disabled={isPending || user.status === "GRADUATED"}
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
          <option value="GRADUATED">GRADUATED</option>
        </select>
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          defaultValue={user.role}
          onChange={(event) => run(() => updateUserRole({ userId: user.id, role: event.target.value }))}
          disabled={isPending}
        >
          <option value="MEMBER">MEMBER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
          defaultValue={selectableGrade ? user.computedGrade : ""}
          onChange={(event) => run(() => updateUserGrade({ userId: user.id, grade: event.target.value }))}
          disabled={isPending || user.status === "GRADUATED" || !user.gradeTrack}
        >
          <option value="" disabled>
            {user.gradeTrack ? user.computedGrade : "未设培养类型"}
          </option>
          {gradeOptions.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs"
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
        { key: "username", header: "用户名", cell: (row) => <span className="font-mono text-xs">{row.username}</span> },
        { key: "name", header: "姓名", cell: (row) => row.displayName },
        { key: "role", header: "角色", cell: (row) => <Badge>{row.role}</Badge> },
        { key: "status", header: "状态", cell: (row) => <Badge>{row.status}</Badge> },
        { key: "grade", header: "年级", cell: (row) => <Badge className="bg-muted">{row.computedGrade}</Badge> },
        { key: "tags", header: "Tag", cell: (row) => row.tags.join(", ") || "-" },
        { key: "actions", header: "治理", cell: (row) => <UserGovernanceActions user={row} advisors={advisors} /> },
      ]}
    />
  );
}
