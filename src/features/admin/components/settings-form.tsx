"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { StatusNotice } from "@/shared/components/ui/status-notice";
import { useToast } from "@/shared/components/ui/toast";

import { updateSystemSettingsFormAction, type SystemSettingsState } from "../actions/update-system-settings";

const initialState: SystemSettingsState = { ok: false, message: null };

function formatMinute(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

export function SettingsForm({
  settings,
}: {
  settings: {
    revision: number;
    progressStartDay: number;
    progressStartMinute: number;
    progressEndDay: number;
    progressEndMinute: number;
    sessionHours: number;
    updatedAt: string;
    updatedBy: string;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(updateSystemSettingsFormAction, initialState);

  useEffect(() => {
    if (!state.message) return;
    toast({ title: state.ok ? "系统设置已保存" : "系统设置保存失败", description: state.message, variant: state.ok ? "success" : "error" });
    if (state.ok) router.refresh();
  }, [router, state, toast]);

  return (
    <form action={formAction} className="grid gap-8" aria-busy={isPending}>
      <input type="hidden" name="revision" value={settings.revision} />

      <fieldset className="space-y-5" disabled={isPending}>
        <legend className="text-lg font-semibold tracking-[-0.022em]">每月进度填写窗口</legend>
        <p className="text-sm leading-6 text-muted-foreground">按 Asia/Shanghai 时区，每月在指定日期与时刻之间开放。</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="progress-start-day">开始日期</Label>
            <div className="flex items-center gap-2">
              <Input id="progress-start-day" name="progressStartDay" type="number" min={1} max={31} defaultValue={settings.progressStartDay} required />
              <span className="shrink-0 text-sm text-muted-foreground">日</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="progress-start-time">开始时间</Label>
            <Input id="progress-start-time" name="progressStartTime" type="time" defaultValue={formatMinute(settings.progressStartMinute)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="progress-end-day">结束日期</Label>
            <div className="flex items-center gap-2">
              <Input id="progress-end-day" name="progressEndDay" type="number" min={1} max={31} defaultValue={settings.progressEndDay} required />
              <span className="shrink-0 text-sm text-muted-foreground">日</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="progress-end-time">结束时间</Label>
            <Input id="progress-end-time" name="progressEndTime" type="time" defaultValue={formatMinute(settings.progressEndMinute)} required />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-border/80 pt-7" disabled={isPending}>
        <legend className="text-lg font-semibold tracking-[-0.022em]">登录会话</legend>
        <div className="max-w-sm space-y-2">
          <Label htmlFor="session-hours">有效时长（小时）</Label>
          <Input id="session-hours" name="sessionHours" type="number" min={1} max={720} defaultValue={settings.sessionHours} required />
        </div>
        <StatusNotice variant="warning">修改会话时长会使全部现有会话失效，所有用户需要重新登录。</StatusNotice>
      </fieldset>

      {!state.ok && state.message ? <StatusNotice variant="error">{state.message}</StatusNotice> : null}
      <div className="flex flex-col gap-3 border-t border-border/80 pt-6 sm:flex-row sm:items-center">
        <Button type="submit" className="w-fit" disabled={isPending}>
          {isPending ? "正在保存…" : "保存设置"}
        </Button>
        <p className="text-xs text-muted-foreground">最后更新：{settings.updatedAt} · {settings.updatedBy}</p>
      </div>
    </form>
  );
}
