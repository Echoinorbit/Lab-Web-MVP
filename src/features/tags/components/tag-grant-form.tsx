"use client";

import { useActionState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { StatusNotice } from "@/shared/components/ui/status-notice";

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
        <CardTitle>Tag 授权</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={grantAction} className="grid gap-3" aria-busy={isGranting}>
          <Label htmlFor="tag-user">成员</Label>
          <Select id="tag-user" name="userId" required>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.username})
              </option>
            ))}
          </Select>
          <Label htmlFor="tag-id">Tag</Label>
          <Select id="tag-id" name="tagId" required>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.displayName} ({tag.name})
              </option>
            ))}
          </Select>
          <Button type="submit" className="w-fit" disabled={isGranting || users.length === 0 || tags.length === 0}>
            {isGranting ? "正在处理…" : "授予 Tag"}
          </Button>
          {grantState.message ? <StatusNotice variant={grantState.ok ? "success" : "error"}>{grantState.message}</StatusNotice> : null}
        </form>
        <form action={revokeAction} className="grid gap-3 border-t border-border/80 pt-5" aria-busy={isRevoking}>
          <Label htmlFor="user-tag-id">现有授权</Label>
          <Select id="user-tag-id" name="userTagId" required>
            {userTags.map((userTag) => (
              <option key={userTag.id} value={userTag.id}>
                {userTag.label}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="destructive" className="w-fit" disabled={isRevoking || userTags.length === 0}>
            {isRevoking ? "正在处理…" : "撤销 Tag"}
          </Button>
          {revokeState.message ? <StatusNotice variant={revokeState.ok ? "success" : "error"}>{revokeState.message}</StatusNotice> : null}
        </form>
      </CardContent>
    </Card>
  );
}
