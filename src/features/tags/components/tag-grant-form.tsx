"use client";

import { useActionState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";

import { grantTagFormAction, type TagActionState } from "../actions/grant-tag";
import { revokeTagFormAction, type RevokeTagState } from "../actions/revoke-tag";

const initialGrantState: TagActionState = { ok: false, message: null };
const initialRevokeState: RevokeTagState = { ok: false, message: null };

export type TagGrantUserOption = {
  id: string;
  username: string;
  displayName: string;
};

export type TagGrantOption = {
  id: string;
  name: string;
  displayName: string;
};

export type UserTagOption = {
  id: string;
  label: string;
};

export function TagGrantForm({
  users,
  tags,
  userTags,
}: {
  users: readonly TagGrantUserOption[];
  tags: readonly TagGrantOption[];
  userTags: readonly UserTagOption[];
}) {
  const [grantState, grantAction, isGranting] = useActionState(grantTagFormAction, initialGrantState);
  const [revokeState, revokeAction, isRevoking] = useActionState(revokeTagFormAction, initialRevokeState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Tag 授权</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={grantAction} className="grid gap-3">
          <Label htmlFor="tag-user">成员</Label>
          <select id="tag-user" name="userId" className="h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20" required>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.username})
              </option>
            ))}
          </select>
          <Label htmlFor="tag-id">Tag</Label>
          <select id="tag-id" name="tagId" className="h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20" required>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.displayName} ({tag.name})
              </option>
            ))}
          </select>
          <Button type="submit" className="w-fit" disabled={isGranting || users.length === 0 || tags.length === 0}>
            {isGranting ? "处理中" : "授予 Tag"}
          </Button>
          {grantState.message ? <p className="text-sm text-muted-foreground">{grantState.message}</p> : null}
        </form>
        <form action={revokeAction} className="grid gap-3 border-t pt-4">
          <Label htmlFor="user-tag-id">现有授权</Label>
          <select id="user-tag-id" name="userTagId" className="h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20" required>
            {userTags.map((userTag) => (
              <option key={userTag.id} value={userTag.id}>
                {userTag.label}
              </option>
            ))}
          </select>
          <Button type="submit" variant="destructive" className="w-fit" disabled={isRevoking || userTags.length === 0}>
            {isRevoking ? "处理中" : "撤销 Tag"}
          </Button>
          {revokeState.message ? <p className="text-sm text-muted-foreground">{revokeState.message}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
