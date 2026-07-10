"use client";

import { useActionState, useState } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { StatusNotice } from "@/shared/components/ui/status-notice";

import { reportFormAction } from "../actions/submit-report";
import { MAX_SUBMITTED_REPORT_EDITS, remainingSubmittedReportEdits } from "../lib/edit-count";
import { describeProgressWriteMode, type ProgressWriteMode, type ReportFormState } from "../lib/report-form";

export type ReportFormInitialValue = {
  studySummary?: string | null;
  projectSummary?: string | null;
  thesisSummary?: string | null;
  otherWork?: string | null;
  externalDays?: number;
  status?: "DRAFT" | "SUBMITTED";
  editCount?: number;
};

const initialState: ReportFormState = { ok: false, message: null };

export function ReportForm({
  year,
  month,
  initialValue,
  writeMode,
}: {
  year: number;
  month: number;
  initialValue?: ReportFormInitialValue | null;
  writeMode: ProgressWriteMode;
}) {
  const [studySummary, setStudySummary] = useState(initialValue?.studySummary ?? "");
  const [projectSummary, setProjectSummary] = useState(initialValue?.projectSummary ?? "");
  const [thesisSummary, setThesisSummary] = useState(initialValue?.thesisSummary ?? "");
  const [otherWork, setOtherWork] = useState(initialValue?.otherWork ?? "");
  const [state, formAction, isPending] = useActionState(reportFormAction, initialState);
  const message = state.message;
  const isSubmitted = state.status === "SUBMITTED" || initialValue?.status === "SUBMITTED";
  const editCount = state.editCount ?? initialValue?.editCount ?? 0;
  const remainingEdits = isSubmitted
    ? remainingSubmittedReportEdits(editCount)
    : MAX_SUBMITTED_REPORT_EDITS;
  const writeAllowed = writeMode === "regular" || writeMode === "backfill";
  const canSave = writeAllowed && !isPending && (!isSubmitted || remainingEdits > 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-border/90 bg-card">
      <header className="border-b border-border/75 px-5 py-5 sm:px-6">
        <h3 className="text-lg font-semibold tracking-[-0.022em]">
          {year} 年 {month} 月进度报告
        </h3>
      </header>
      <div className="p-5 sm:p-6">
        <form className="grid gap-5" action={formAction} aria-busy={isPending}>
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <Label>学习总结</Label>
          <MarkdownEditor name="studySummary" value={studySummary} onChange={setStudySummary} placeholder="本月学习情况" disabled={!writeAllowed} />
          <Label>项目工作总结</Label>
          <MarkdownEditor name="projectSummary" value={projectSummary} onChange={setProjectSummary} placeholder="本月项目推进" disabled={!writeAllowed} />
          <Label>论文工作总结</Label>
          <MarkdownEditor name="thesisSummary" value={thesisSummary} onChange={setThesisSummary} placeholder="本月论文进展" disabled={!writeAllowed} />
          <Label>其他工作内容</Label>
          <MarkdownEditor name="otherWork" value={otherWork} onChange={setOtherWork} placeholder="其他事项" disabled={!writeAllowed} />
          <div className="space-y-2">
            <Label htmlFor="externalDays">外出项目工作天数</Label>
            <Input id="externalDays" name="externalDays" type="number" min={0} max={31} defaultValue={initialValue?.externalDays ?? 0} disabled={!writeAllowed} />
          </div>
          <StatusNotice>{describeProgressWriteMode(writeMode)}</StatusNotice>
          {isSubmitted ? (
            <StatusNotice variant={remainingEdits > 0 ? "warning" : "error"}>
              报告已提交，不能重复提交；剩余可保存修改 {remainingEdits} 次。
            </StatusNotice>
          ) : null}
          {message ? <StatusNotice variant={state.ok ? "success" : "error"}>{message}</StatusNotice> : null}
          <div className="flex flex-wrap gap-2 border-t border-border/80 pt-5">
            <Button type="submit" name="intent" value="save" variant="secondary" disabled={!canSave}>
              {isPending ? "正在处理…" : isSubmitted && remainingEdits === 0 ? "修改次数已用完" : isSubmitted ? "保存修改" : "保存草稿"}
            </Button>
            <Button type="submit" name="intent" value="submit" disabled={isPending || isSubmitted || !writeAllowed}>
              {isSubmitted ? "已提交（不可重复）" : "提交报告"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
