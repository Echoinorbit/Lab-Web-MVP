"use client";

import { useActionState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

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
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="admin-username">用户名</Label>
        <Input id="admin-username" name="username" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="admin-name">显示名称</Label>
        <Input id="admin-name" name="displayName" required />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="admin-password">临时密码</Label>
        <Input id="admin-password" name="password" type="password" required />
        <p className="text-xs leading-5 text-muted-foreground">
          至少 10 位，并包含大小写字母、数字、符号中的至少三类；不能包含用户名或学号。
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="admin-student-id">学号</Label>
        <Input id="admin-student-id" name="studentId" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="admin-grade">年级</Label>
        <Input id="admin-grade" name="grade" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="admin-advisor">导师</Label>
        <Select id="admin-advisor" name="advisorId" className="w-full">
          <option value="">未设置</option>
          {advisors.map((advisor) => (
            <option key={advisor.id} value={advisor.id}>
              {advisor.displayName} ({advisor.username})
            </option>
          ))}
        </Select>
      </div>
      {message ? <p className={`sm:col-span-2 ${state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}`}>{message}</p> : null}
      <Button type="submit" className="w-fit sm:col-span-2" disabled={isPending}>
        {isPending ? "创建中" : "创建成员"}
      </Button>
    </form>
  );
}
