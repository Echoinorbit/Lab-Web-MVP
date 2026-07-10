"use client";

import { useActionState, useState } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

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
    <Card>
      <CardHeader>
        <CardTitle>
          {year} 年 {month} 月进度报告
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" action={formAction}>
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
          <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
            {describeProgressWriteMode(writeMode)}
          </p>
          {isSubmitted ? (
            <p className="text-sm text-muted-foreground">
              报告已提交，不能重复提交；剩余可保存修改 {remainingEdits} 次。
            </p>
          ) : null}
          {message ? <p className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{message}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" name="intent" value="save" variant="secondary" disabled={!canSave}>
              {isPending ? "处理中" : isSubmitted && remainingEdits === 0 ? "修改次数已用完" : isSubmitted ? "保存修改" : "保存草稿"}
            </Button>
            <Button type="submit" name="intent" value="submit" disabled={isPending || isSubmitted || !writeAllowed}>
              {isSubmitted ? "已提交（不可重复）" : "提交"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
