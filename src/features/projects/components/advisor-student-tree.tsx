"use client";

import type { Dispatch, SetStateAction } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { Label } from "@/shared/components/ui/label";
import { StatusNotice } from "@/shared/components/ui/status-notice";

export type ProjectStudentOption = {
  id: string;
  username: string;
  displayName: string;
  grade?: string | null;
  studentId?: string | null;
};

export type ProjectAdvisorOption = {
  id: string;
  username: string;
  displayName: string;
  students: readonly ProjectStudentOption[];
};

export function AdvisorStudentTree({
  advisor,
  selectedIds,
  onSelectedIdsChange,
  leadUserId,
  onLeadUserIdChange,
  memberInputName = "memberUserIds",
}: {
  advisor?: ProjectAdvisorOption;
  selectedIds: readonly string[];
  onSelectedIdsChange: Dispatch<SetStateAction<string[]>>;
  leadUserId?: string;
  onLeadUserIdChange?: (id: string) => void;
  memberInputName?: string;
}) {
  const selected = new Set(selectedIds);

  if (!advisor) {
    return <StatusNotice>请先选择负责导师，再选择其直属在读学生。</StatusNotice>;
  }

  return (
    <fieldset className="space-y-4 rounded-xl border border-border/80 bg-background/45 p-4 sm:p-5">
      <legend className="px-2 text-sm font-medium">项目学生与组长</legend>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{advisor.displayName}</span>
        <Badge>直属学生 {advisor.students.length} 人</Badge>
      </div>
      {advisor.students.length === 0 ? (
        <p className="text-sm text-muted-foreground">该导师暂无可加入项目的直属在读学生。</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {advisor.students.map((student) => {
            const checked = selected.has(student.id);
            return (
              <div key={student.id} data-project-student-row className="rounded-[10px] border border-border/80 bg-card p-3.5 transition-colors duration-[var(--motion-fast)] hover:bg-muted/45">
                <div className="flex items-start gap-2">
                  <input
                    id={`student-${student.id}`}
                    name={memberInputName}
                    value={student.id}
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-primary"
                    checked={checked}
                    onChange={(event) => {
                      const isChecked = event.target.checked;
                      onSelectedIdsChange((currentIds) =>
                        isChecked
                          ? currentIds.includes(student.id)
                            ? currentIds
                            : [...currentIds, student.id]
                          : currentIds.filter((id) => id !== student.id),
                      );
                      if (!isChecked && leadUserId === student.id) onLeadUserIdChange?.("");
                    }}
                  />
                  <Label htmlFor={`student-${student.id}`} className="min-w-0 flex-1 cursor-pointer leading-5">
                    <span className="block font-medium">{student.displayName}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {student.studentId ?? student.username}{student.grade ? ` · ${student.grade}` : ""}
                    </span>
                  </Label>
                </div>
                {onLeadUserIdChange ? (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="radio"
                      className="h-4 w-4 accent-primary"
                      name="leadUserId"
                      value={student.id}
                      checked={leadUserId === student.id}
                      disabled={!checked}
                      onChange={() => onLeadUserIdChange(student.id)}
                    />
                    设为项目组长
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
