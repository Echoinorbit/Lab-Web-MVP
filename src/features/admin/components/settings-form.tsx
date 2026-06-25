"use client";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

export function SettingsForm() {
  return (
    <form className="grid max-w-xl gap-4">
      <div className="space-y-2">
        <Label htmlFor="progress-window">进度填写窗口</Label>
        <Input id="progress-window" name="progressWindow" defaultValue="25-27" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="session-hours">Session 小时数</Label>
        <Input id="session-hours" name="sessionHours" type="number" min={1} max={24} defaultValue={24} />
      </div>
      <Button type="submit" className="w-fit">
        保存设置
      </Button>
    </form>
  );
}
