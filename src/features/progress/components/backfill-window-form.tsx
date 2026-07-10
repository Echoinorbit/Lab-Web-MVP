"use client";

import { useActionState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";

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
        <CardTitle className="text-sm">补填窗口</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <Label htmlFor="backfill-user">成员</Label>
          <select id="backfill-user" name="userId" className="h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20" required>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.username})
              </option>
            ))}
          </select>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button type="submit" className="w-fit" disabled={isPending || users.length === 0}>
            {isPending ? "处理中" : "开启 24h 窗口"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
