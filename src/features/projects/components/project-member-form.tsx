"use client";

import { useActionState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";

import { addProjectMemberFormAction, type ProjectMemberState } from "../actions/add-member";

export type ProjectMemberOption = {
  id: string;
  username: string;
  displayName: string;
};

const initialState: ProjectMemberState = { ok: false, message: null };

export function ProjectMemberForm({
  projectId,
  users,
}: {
  projectId: string;
  users: readonly ProjectMemberOption[];
}) {
  const [state, formAction, isPending] = useActionState(addProjectMemberFormAction, initialState);
  const message = state.message;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">邀请成员</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="projectId" value={projectId} />
          <Label htmlFor="project-member-user">成员</Label>
          <select id="project-member-user" name="userId" className="h-9 rounded-md border bg-background px-3 text-sm" required>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.username})
              </option>
            ))}
          </select>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button type="submit" className="w-fit" disabled={isPending || users.length === 0}>
            {isPending ? "处理中" : "加入项目"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
