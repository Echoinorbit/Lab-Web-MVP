"use client";

import { useActionState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { createUserFormAction, type CreateUserFormState } from "../actions/create-user";

export type AdvisorOption = {
  id: string;
  displayName: string;
  username: string;
};

const initialState: CreateUserFormState = { ok: false, message: null };

export function UserCreateForm({ advisors = [] }: { advisors?: readonly AdvisorOption[] }) {
  const [state, formAction, isPending] = useActionState(createUserFormAction, initialState);
  const message = state.message;

  return (
    <form action={formAction} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="admin-username">用户名</Label>
        <Input id="admin-username" name="username" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-name">显示名称</Label>
        <Input id="admin-name" name="displayName" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-password">临时密码</Label>
        <Input id="admin-password" name="password" type="password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-student-id">学号</Label>
        <Input id="admin-student-id" name="studentId" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-grade">年级</Label>
        <Input id="admin-grade" name="grade" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-advisor">导师</Label>
        <select id="admin-advisor" name="advisorId" className="h-9 rounded-md border bg-background px-3 text-sm">
          <option value="">未设置</option>
          {advisors.map((advisor) => (
            <option key={advisor.id} value={advisor.id}>
              {advisor.displayName} ({advisor.username})
            </option>
          ))}
        </select>
      </div>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <Button type="submit" className="w-fit" disabled={isPending}>
        {isPending ? "创建中" : "创建成员"}
      </Button>
    </form>
  );
}
