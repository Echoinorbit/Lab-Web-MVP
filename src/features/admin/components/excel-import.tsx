"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FileUpload } from "@/shared/components/file-upload";
import { Button } from "@/shared/components/ui/button";

import { importUsers, type ImportUsersResult } from "../actions/import-users";

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
