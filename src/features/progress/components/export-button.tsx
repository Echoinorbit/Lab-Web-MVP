"use client";

import { Download } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/shared/components/ui/button";

import { exportProgressReports } from "../actions/export-excel";

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
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    setMessage(null);
    startTransition(async () => {
      try {
        const base64 = await exportProgressReports(year, month);
        downloadBase64Xlsx(base64, `progress-${year}-${String(month).padStart(2, "0")}.xlsx`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "导出失败");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="secondary" onClick={handleExport} disabled={isPending}>
        <Download className="h-4 w-4" />
        {isPending ? "导出中" : "导出 Excel"}
      </Button>
      {message ? <span className="text-sm text-destructive">{message}</span> : null}
    </div>
  );
}
