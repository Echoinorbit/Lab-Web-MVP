"use client";

import { useActionState, useState } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { createProjectFormAction, type ProjectFormState } from "../actions/create-project";

const initialState: ProjectFormState = { ok: false, message: null };

export type ProjectUserOption = {
  id: string;
  username: string;
  displayName: string;
};

export function ProjectForm({
  users,
  advisors,
}: {
  users: readonly ProjectUserOption[];
  advisors: readonly ProjectUserOption[];
}) {
  const [description, setDescription] = useState("");
  const [state, formAction, isPending] = useActionState(createProjectFormAction, initialState);
  const message = state.message;

  return (
    <form action={formAction} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="project-name">项目名</Label>
        <Input id="project-name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label>描述</Label>
        <MarkdownEditor name="description" value={description} onChange={setDescription} placeholder="项目目标、范围与里程碑" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-lead">项目组长</Label>
        <select id="project-lead" name="leadUserId" className="h-9 rounded-md border bg-background px-3 text-sm" required>
          <option value="">选择组长</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName} ({user.username})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-members">项目组员</Label>
        <select id="project-members" name="memberUserIds" className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm" multiple>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName} ({user.username})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-advisor">负责导师</Label>
        <select id="project-advisor" name="advisorId" className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">暂不指定</option>
          {advisors.map((advisor) => (
            <option key={advisor.id} value={advisor.id}>
              {advisor.displayName} ({advisor.username})
            </option>
          ))}
        </select>
      </div>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <Button type="submit" className="w-fit" disabled={isPending}>
        {isPending ? "创建中" : "创建"}
      </Button>
    </form>
  );
}
