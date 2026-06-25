"use client";

import { useState } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { ALL_TARGET_LABEL } from "../lib/target-copy";
import type { AnnouncementProjectOption } from "./announcement-form";

const targetTypes = [
  { value: "ALL", label: "全员" },
  { value: "PROJECT", label: "项目" },
  { value: "TAG", label: "Tag" },
  { value: "USERS", label: "成员" },
] as const;

export function TargetSelector({ projects = [] }: { projects?: readonly AnnouncementProjectOption[] }) {
  const [targetType, setTargetType] = useState<(typeof targetTypes)[number]["value"]>("ALL");
  return (
    <div className="space-y-3">
      <Label>通知范围</Label>
      <div className="flex flex-wrap gap-2">
        {targetTypes.map((option) => {
          const disabled = option.value === "PROJECT" && projects.length === 0;
          return (
            <button
              key={option.value}
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm transition-colors data-[active=true]:bg-primary data-[active=true]:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              data-active={targetType === option.value}
              disabled={disabled}
              onClick={() => setTargetType(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <input type="hidden" name="targetType" value={targetType} />
      {targetType === "ALL" ? (
        <Badge className="bg-muted">{ALL_TARGET_LABEL}</Badge>
      ) : targetType === "PROJECT" ? (
        <select name="targetIds" className="h-9 rounded-md border bg-background px-3 text-sm" required>
          <option value="">选择项目</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      ) : (
        <Input name="targetIds" placeholder="输入目标 ID，多个用逗号分隔" />
      )}
    </div>
  );
}
