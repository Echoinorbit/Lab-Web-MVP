"use client";

import { useActionState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

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
          <Select id="backfill-user" name="userId" className="w-full" required>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.username})
              </option>
            ))}
          </Select>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button type="submit" className="w-fit" disabled={isPending || users.length === 0}>
            {isPending ? "处理中" : "开启 24h 窗口"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
