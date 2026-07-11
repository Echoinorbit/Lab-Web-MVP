"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FileUpload } from "@/shared/components/file-upload";
import { Button, buttonStyles } from "@/shared/components/ui/button";
import { StatusNotice } from "@/shared/components/ui/status-notice";
import { useToast } from "@/shared/components/ui/toast";
import { STUDY_GRADE_LABELS } from "@/shared/lib/study-identity";

import {
  confirmUserImportResult,
  previewUserImportResult,
  type ImportUsersPreviewResult,
} from "../actions/import-users";
import { USER_IMPORT_COLUMNS } from "../lib/user-import-template";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const degreeLabels = { MASTER: "硕士生", DOCTOR: "博士生", MENTOR: "导师" } as const;

export function ExcelImport() {
  const router = useRouter();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportUsersPreviewResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function chooseFile(files: File[]) {
    setFile(files[0] ?? null);
    setBase64(null);
    setPreview(null);
    setMessage(null);
  }

  function handlePreview() {
    if (!file) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const encoded = await fileToBase64(file);
        const response = await previewUserImportResult({ fileName: file.name, base64: encoded });
        if (!response.ok) {
          setMessage(response.message);
          toast({ title: "无法生成导入预览", description: response.message, variant: "error" });
          return;
        }
        const result = response.data;
        setBase64(encoded);
        setPreview(result);
        if (result.errors.length > 0) {
          toast({ title: "导入预览存在问题", description: "请修正列出的行后重新选择文件。", variant: "error" });
        } else {
          toast({ title: `已校验 ${result.rows.length} 行`, description: "确认无误后再写入数据库。", variant: "success" });
        }
      } catch {
        const nextMessage = "读取 Excel 文件失败，请重新选择。";
        setMessage(nextMessage);
        toast({ title: "无法生成导入预览", description: nextMessage, variant: "error" });
      }
    });
  }

  function handleConfirm() {
    if (!file || !base64 || !preview?.previewToken) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await confirmUserImportResult({ fileName: file.name, base64, previewToken: preview.previewToken });
        if (!response.ok) {
          setMessage(response.message);
          toast({ title: "导入失败", description: response.message, variant: "error" });
          return;
        }
        const result = response.data;
        if (result.errors.length > 0) {
          setPreview((current) => current ? { ...current, errors: result.errors, previewToken: null, expiresAt: null } : current);
          toast({ title: "整批未导入", description: "提交时检测到冲突，请修正后重新预览。", variant: "error" });
          return;
        }
        toast({ title: `已创建 ${result.created} 个成员`, description: "用户与系统身份 Tag 已同步。", variant: "success" });
        setFile(null);
        setBase64(null);
        setPreview(null);
        router.refresh();
      } catch {
        const nextMessage = "导入请求失败，请稍后重试。";
        setMessage(nextMessage);
        toast({ title: "导入失败", description: nextMessage, variant: "error" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-border/80 bg-background/50 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Excel 列格式（顺序不可变）</p>
          <a href="/api/admin/users/import-template" download className={buttonStyles({ variant: "secondary", size: "small" })}>下载 .xlsx 模板</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-xs">
            <thead><tr className="border-b text-muted-foreground"><th className="p-2">列名</th><th className="p-2">要求</th><th className="p-2">说明</th><th className="p-2">示例</th></tr></thead>
            <tbody>
              {USER_IMPORT_COLUMNS.map((column) => (
                <tr key={column.key} className="border-b last:border-0">
                  <td className="p-2 font-mono">{column.header}</td><td className="p-2">{column.required ? "必填" : "选填"}</td>
                  <td className="p-2 text-muted-foreground">{column.description}</td><td className="p-2 font-mono">{column.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FileUpload onFiles={chooseFile} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple={false} />
      {file ? <p className="text-sm text-muted-foreground">已选择：{file.name}</p> : null}
      {message ? <StatusNotice variant="error">{message}</StatusNotice> : null}

      {preview ? (
        <section className="space-y-3" aria-label="导入预览">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-semibold">写入前预览</h3>
              <p className="mt-1 text-xs text-muted-foreground">预览凭据有效期 5 分钟；密码不会在页面显示。</p>
            </div>
            {preview.expiresAt ? <time className="text-xs text-muted-foreground">有效至 {new Date(preview.expiresAt).toLocaleString("zh-CN")}</time> : null}
          </div>
          <div className="max-h-80 overflow-auto rounded-xl border border-border/90" tabIndex={0} role="region" aria-label="待导入成员，可滚动">
            <table className="w-full min-w-[680px] border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-surface"><tr><th className="p-3">行</th><th className="p-3">用户名</th><th className="p-3">姓名</th><th className="p-3">学号/工号</th><th className="p-3">身份</th><th className="p-3">年级</th></tr></thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber} className="border-t border-border/75">
                    <td className="p-3 tabular-nums">{row.rowNumber}</td><td className="p-3 font-mono">{row.username}</td><td className="p-3">{row.displayName}</td>
                    <td className="p-3">{row.studentId ?? "—"}</td><td className="p-3">{degreeLabels[row.studyDegree]}</td>
                    <td className="p-3">{row.studyGrade ? STUDY_GRADE_LABELS[row.studyGrade] : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.errors.length > 0 ? (
            <StatusNotice variant="error" title="请先修正以下问题">
              <ul className="list-disc space-y-1 pl-5">{preview.errors.map((error) => <li key={error}>{error}</li>)}</ul>
            </StatusNotice>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={handlePreview} disabled={isPending || !file}>
          {isPending && !preview ? "正在校验…" : "预览并校验"}
        </Button>
        {preview?.previewToken ? (
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            {isPending ? "正在写入…" : `确认导入 ${preview.rows.length} 人`}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
