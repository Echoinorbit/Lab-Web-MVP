"use client";

import { useActionState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { StatusNotice } from "@/shared/components/ui/status-notice";

import { openBackfillWindowFormAction, type BackfillFormState } from "../actions/open-backfill-window";

export type BackfillTargetUser = {
  id: string;
  displayName: string;
  username: string;
};

const initialState: BackfillFormState = { ok: false, message: null };

export function BackfillWindowForm({
  year,
  month,
  users,
}: {
  year: number;
  month: number;
  users: readonly BackfillTargetUser[];
}) {
  const [state, formAction, isPending] = useActionState(openBackfillWindowFormAction, initialState);
  const message = state.message;

  return (
    <Card>
      <CardHeader>
        <CardTitle>补填窗口</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3" aria-busy={isPending}>
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <Label htmlFor="backfill-user">成员</Label>
          <Select id="backfill-user" name="userId" className="w-full" required>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.username})
              </option>
            ))}
          </Select>
          <p className="text-sm leading-6 text-muted-foreground">为选中成员开启一次 24 小时补填授权；保存草稿不会消费窗口。</p>
          {message ? <StatusNotice variant={state.ok ? "success" : "error"}>{message}</StatusNotice> : null}
          <Button type="submit" className="w-fit" disabled={isPending || users.length === 0}>
            {isPending ? "正在处理…" : "开启 24 小时窗口"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
