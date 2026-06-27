"use client";

import { Badge } from "@/shared/components/ui/badge";
import { Label } from "@/shared/components/ui/label";

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
  onSelectedIdsChange: (ids: string[]) => void;
  leadUserId?: string;
  onLeadUserIdChange?: (id: string) => void;
  memberInputName?: string;
}) {
  const selected = new Set(selectedIds);

  if (!advisor) {
    return <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">请先选择负责导师。</p>;
  }

  return (
    <fieldset className="space-y-3 rounded-md border p-4">
      <legend className="px-2 text-sm font-medium">学生树</legend>
      <div className="flex items-center gap-2 text-sm">
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
              <div key={student.id} className="rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <input
                    id={`student-${student.id}`}
                    name={memberInputName}
                    value={student.id}
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...selectedIds, student.id]
                        : selectedIds.filter((id) => id !== student.id);
                      onSelectedIdsChange(next);
                      if (!event.target.checked && leadUserId === student.id) onLeadUserIdChange?.("");
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
