"use client";

import { useActionState, useState } from "react";

import { MarkdownEditor } from "@/shared/components/markdown-editor";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

import { reportFormAction } from "../actions/submit-report";
import { MAX_SUBMITTED_REPORT_EDITS, remainingSubmittedReportEdits } from "../lib/edit-count";
import { type ReportFormState } from "../lib/report-form";

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
}: {
  year: number;
  month: number;
  initialValue?: ReportFormInitialValue | null;
}) {
  const [studySummary, setStudySummary] = useState(initialValue?.studySummary ?? "");
  const [projectSummary, setProjectSummary] = useState(initialValue?.projectSummary ?? "");
  const [thesisSummary, setThesisSummary] = useState(initialValue?.thesisSummary ?? "");
  const [otherWork, setOtherWork] = useState(initialValue?.otherWork ?? "");
  const [state, formAction, isPending] = useActionState(reportFormAction, initialState);
  const message = state.message;
  const isSubmitted = initialValue?.status === "SUBMITTED";
  const remainingEdits = isSubmitted
    ? remainingSubmittedReportEdits(initialValue?.editCount ?? 0)
    : MAX_SUBMITTED_REPORT_EDITS;
  const canSave = !isPending && (!isSubmitted || remainingEdits > 0);

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
          <MarkdownEditor name="studySummary" value={studySummary} onChange={setStudySummary} placeholder="本月学习情况" />
          <Label>项目工作总结</Label>
          <MarkdownEditor name="projectSummary" value={projectSummary} onChange={setProjectSummary} placeholder="本月项目推进" />
          <Label>论文工作总结</Label>
          <MarkdownEditor name="thesisSummary" value={thesisSummary} onChange={setThesisSummary} placeholder="本月论文进展" />
          <Label>其他工作内容</Label>
          <MarkdownEditor name="otherWork" value={otherWork} onChange={setOtherWork} placeholder="其他事项" />
          <div className="space-y-2">
            <Label htmlFor="externalDays">外出项目工作天数</Label>
            <Input id="externalDays" name="externalDays" type="number" min={0} max={31} defaultValue={initialValue?.externalDays ?? 0} />
          </div>
          {isSubmitted ? <p className="text-sm text-muted-foreground">提交后剩余修改次数：{remainingEdits}</p> : null}
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" name="intent" value="save" variant="secondary" disabled={!canSave}>
              {isPending ? "处理中" : isSubmitted ? "保存修改" : "保存草稿"}
            </Button>
            <Button type="submit" name="intent" value="submit" disabled={isPending || isSubmitted}>
              {isSubmitted ? "已提交" : "提交"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
