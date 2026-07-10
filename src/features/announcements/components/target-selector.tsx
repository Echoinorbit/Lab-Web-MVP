"use client";

import { useState } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";

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
              aria-pressed={targetType === option.value}
              className="rounded-full border border-input px-3.5 py-2 text-sm font-medium transition-[color,background-color,border-color] duration-200 hover:border-foreground/20 hover:bg-muted data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
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
        <Select name="targetIds" className="w-full" required>
          <option value="">选择项目</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      ) : (
        <Input name="targetIds" placeholder="输入目标 ID，多个用逗号分隔" />
      )}
    </div>
  );
}
