"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FileUpload } from "@/shared/components/file-upload";
import { Button } from "@/shared/components/ui/button";

import { importUsers, type ImportUsersResult } from "../actions/import-users";
import { USER_IMPORT_COLUMNS } from "../lib/user-import-template";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] ?? "" : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function ExcelImport() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<ImportUsersResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleImport() {
    const file = files[0];
    if (!file) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const base64 = await fileToBase64(file);
        const importResult = await importUsers({ fileName: file.name, base64 });
        setResult(importResult);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "导入失败");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-md border p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">Excel 列格式（顺序不可变）</p>
          <a
            href="/api/admin/users/import-template"
            download
            className="inline-flex h-8 items-center rounded-md bg-secondary px-3 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            下载 .xlsx 模板
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-2">列名</th>
                <th className="p-2">要求</th>
                <th className="p-2">说明</th>
                <th className="p-2">示例</th>
              </tr>
            </thead>
            <tbody>
              {USER_IMPORT_COLUMNS.map((column) => (
                <tr key={column.key} className="border-b last:border-0">
                  <td className="p-2 font-mono">{column.header}</td>
                  <td className="p-2">{column.required ? "必填" : "选填"}</td>
                  <td className="p-2 text-muted-foreground">{column.description}</td>
                  <td className="p-2 font-mono">{column.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <FileUpload onFiles={setFiles} />
      {files.length > 0 ? (
        <ul className="text-sm text-muted-foreground">
          {files.map((file) => (
            <li key={file.name}>{file.name}</li>
          ))}
        </ul>
      ) : null}
      {result ? (
        <div className="rounded-md bg-muted p-3 text-sm">
          <div>创建 {result.created} 个成员</div>
          {result.errors.length ? <div className="mt-1 text-destructive">{result.errors.join("；")}</div> : null}
        </div>
      ) : null}
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <Button type="button" variant="secondary" onClick={handleImport} disabled={isPending || files.length === 0}>
        {isPending ? "导入中" : "导入成员"}
      </Button>
    </div>
  );
}
