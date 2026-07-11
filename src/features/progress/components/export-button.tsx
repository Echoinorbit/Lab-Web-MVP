"use client";

import { Download } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/toast";

import { exportProgressReportsResult } from "../actions/export-excel";

function downloadBase64Xlsx(base64: string, fileName: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ year, month }: { year: number; month: number }) {
  const { toast } = useToast();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await exportProgressReportsResult(year, month);
        if (!result.ok) {
          setMessage(result.message);
          toast({ title: "报表导出失败", description: result.message, variant: "error" });
          return;
        }
        downloadBase64Xlsx(result.data, `progress-${year}-${String(month).padStart(2, "0")}.xlsx`);
        toast({ title: "进度报表已导出", variant: "success" });
      } catch {
        const nextMessage = "导出请求失败，请稍后重试。";
        setMessage(nextMessage);
        toast({ title: "报表导出失败", description: nextMessage, variant: "error" });
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="secondary" onClick={handleExport} disabled={isPending}>
        <Download className="h-4 w-4" aria-hidden="true" />
        {isPending ? "正在导出…" : "导出 Excel"}
      </Button>
      {message ? <span className="text-sm text-destructive">{message}</span> : null}
    </div>
  );
}
