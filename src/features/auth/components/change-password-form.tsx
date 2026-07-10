"use client";

import { useActionState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { changePasswordFormAction, type ChangePasswordFormState } from "../actions/change-password";

const initialState: ChangePasswordFormState = { ok: false, message: null };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordFormAction, initialState);
  const error = state.message;

  return (
    <form className="grid gap-5" action={formAction}>
      <div className="space-y-2">
        <Label htmlFor="currentPassword">当前密码</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">新密码</Label>
        <Input id="newPassword" name="newPassword" type="password" minLength={10} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">确认新密码</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" minLength={10} required />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="h-11" disabled={pending}>
        {pending ? "保存中" : "保存"}
      </Button>
    </form>
  );
}
