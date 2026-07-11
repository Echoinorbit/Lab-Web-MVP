"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ConfirmDialog } from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { useToast } from "@/shared/components/ui/toast";

import { grantTagResult } from "../actions/grant-tag";
import { revokeTagResult } from "../actions/revoke-tag";

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
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [tagId, setTagId] = useState(tags[0]?.id ?? "");
  const [userTagId, setUserTagId] = useState(userTags[0]?.id ?? "");
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedGrant = useMemo(() => userTags.find((item) => item.id === userTagId), [userTagId, userTags]);

  useEffect(() => {
    if (!users.some((user) => user.id === userId)) setUserId(users[0]?.id ?? "");
  }, [userId, users]);

  useEffect(() => {
    if (!tags.some((tag) => tag.id === tagId)) setTagId(tags[0]?.id ?? "");
  }, [tagId, tags]);

  useEffect(() => {
    if (!userTags.some((userTag) => userTag.id === userTagId)) setUserTagId(userTags[0]?.id ?? "");
  }, [userTagId, userTags]);

  function handleGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !tagId) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await grantTagResult({ userId, tagId });
        if (!result.ok) {
          setError(result.message);
          toast({ title: "Tag 授予失败", description: result.message, variant: "error" });
          return;
        }
        toast({ title: "Tag 已授予", description: "有效持有人与授权清单已刷新。", variant: "success" });
        router.refresh();
      } catch {
        const message = "Tag 授予请求失败，请稍后重试。";
        setError(message);
        toast({ title: "Tag 授予失败", description: message, variant: "error" });
      }
    });
  }

  function handleRevoke() {
    if (!userTagId) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await revokeTagResult({ userTagId });
        if (!result.ok) {
          setError(result.message);
          toast({ title: "Tag 撤销失败", description: result.message, variant: "error" });
          return;
        }
        setRevokeOpen(false);
        toast({ title: "Tag 已撤销", description: "权限变化将在下一次服务端校验时生效。", variant: "success" });
        router.refresh();
      } catch {
        const message = "Tag 撤销请求失败，请稍后重试。";
        setError(message);
        toast({ title: "Tag 撤销失败", description: message, variant: "error" });
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tag 授权</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          <form onSubmit={handleGrant} className="grid gap-3" aria-busy={isPending}>
            <Label htmlFor="tag-user">成员</Label>
            <Select id="tag-user" className="w-full" value={userId} onChange={(event) => setUserId(event.target.value)} required>
              {users.length === 0 ? <option value="">没有符合筛选条件的在用成员</option> : null}
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} ({user.username})
                </option>
              ))}
            </Select>
            <Label htmlFor="tag-id">Tag</Label>
            <Select id="tag-id" className="w-full" value={tagId} onChange={(event) => setTagId(event.target.value)} required>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.displayName} ({tag.name})
                </option>
              ))}
            </Select>
            <Button type="submit" className="w-fit" disabled={isPending || !userId || !tagId}>
              {isPending ? "正在处理…" : "授予 Tag"}
            </Button>
          </form>
          <div className="grid gap-3 border-t border-border/80 pt-5">
            <Label htmlFor="user-tag-id">现有授权（当前成员页）</Label>
            <Select id="user-tag-id" className="w-full" value={userTagId} onChange={(event) => setUserTagId(event.target.value)} required>
              {userTags.length === 0 ? <option value="">没有符合筛选条件的手动授权</option> : null}
              {userTags.map((userTag) => (
                <option key={userTag.id} value={userTag.id}>
                  {userTag.label}
                </option>
              ))}
            </Select>
            <Button type="button" variant="destructive" className="w-fit" disabled={isPending || !userTagId} onClick={() => setRevokeOpen(true)}>
              撤销 Tag
            </Button>
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="确认撤销这个 Tag？"
        description="撤销后，该 Tag 提供的能力会在下一次服务端权限校验时失效。"
        confirmLabel="确认撤销"
        destructive
        pending={isPending}
        onConfirm={handleRevoke}
      >
        <p className="rounded-xl bg-muted px-3 py-2 text-sm">{selectedGrant?.label ?? "所选授权已不存在"}</p>
      </ConfirmDialog>
    </>
  );
}
