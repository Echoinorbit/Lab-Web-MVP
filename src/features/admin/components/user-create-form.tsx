"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Select } from "@/shared/components/ui/select";
import { StatusNotice } from "@/shared/components/ui/status-notice";
import { useToast } from "@/shared/components/ui/toast";
import { STUDY_GRADES, STUDY_GRADE_LABELS } from "@/shared/lib/study-identity";

import { createUserFormAction, type CreateUserFormState } from "../actions/create-user";

export type AdvisorOption = {
  id: string;
  displayName: string;
  username: string;
};

const initialState: CreateUserFormState = { ok: false, message: null };
const degreeLabels = { MASTER: "硕士生", DOCTOR: "博士生", MENTOR: "导师" } as const;

export function UserCreateForm({ advisors = [] }: { advisors?: readonly AdvisorOption[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [degree, setDegree] = useState<keyof typeof STUDY_GRADES>("MASTER");
  const [state, formAction, isPending] = useActionState(createUserFormAction, initialState);
  const grades = STUDY_GRADES[degree];

  useEffect(() => {
    if (!state.message) return;
    toast({ title: state.ok ? "成员已创建" : "成员创建失败", description: state.message, variant: state.ok ? "success" : "error" });
    if (state.ok) {
      formRef.current?.reset();
      setDegree("MASTER");
      router.refresh();
    }
  }, [router, state, toast]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 sm:grid-cols-2" aria-busy={isPending}>
      <div className="space-y-1.5">
        <Label htmlFor="admin-username">用户名</Label>
        <Input id="admin-username" name="username" minLength={2} maxLength={80} required disabled={isPending} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="admin-name">显示名称</Label>
        <Input id="admin-name" name="displayName" maxLength={120} required disabled={isPending} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="admin-password">临时密码</Label>
        <Input id="admin-password" name="password" type="password" minLength={10} maxLength={256} required disabled={isPending} />
        <p className="text-xs leading-5 text-muted-foreground">至少 10 位，并包含大小写字母、数字、符号中的至少三类；不能包含用户名或学号。</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="admin-student-id">学号 / 工号</Label>
        <Input id="admin-student-id" name="studentId" maxLength={80} disabled={isPending} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="admin-study-degree">在读学位</Label>
        <Select
          id="admin-study-degree"
          name="studyDegree"
          value={degree}
          onChange={(event) => setDegree(event.target.value as keyof typeof STUDY_GRADES)}
          className="w-full"
          disabled={isPending}
          required
        >
          {Object.entries(degreeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>
      {degree !== "MENTOR" ? (
        <div className="space-y-1.5">
          <Label htmlFor="admin-study-grade">年级</Label>
          <Select id="admin-study-grade" name="studyGrade" key={degree} defaultValue={grades[0]} className="w-full" disabled={isPending} required>
            {grades.map((grade) => <option key={grade} value={grade}>{STUDY_GRADE_LABELS[grade]}</option>)}
          </Select>
        </div>
      ) : null}
      {degree !== "MENTOR" ? (
        <div className="space-y-1.5">
          <Label htmlFor="admin-advisor">导师</Label>
          <Select id="admin-advisor" name="advisorId" className="w-full" disabled={isPending}>
            <option value="">未设置</option>
            {advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.displayName} ({advisor.username})</option>)}
          </Select>
        </div>
      ) : null}
      {!state.ok && state.message ? <StatusNotice className="sm:col-span-2" variant="error">{state.message}</StatusNotice> : null}
      <Button type="submit" className="w-fit sm:col-span-2" disabled={isPending}>
        {isPending ? "正在创建…" : "创建成员"}
      </Button>
    </form>
  );
}
