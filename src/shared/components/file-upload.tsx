"use client";

import { Upload } from "lucide-react";
import type { ChangeEvent } from "react";

export function FileUpload({ onFiles }: { onFiles: (files: File[]) => void }) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.target.files ?? []));
  };

  return (
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed bg-card px-4 py-6 text-sm text-muted-foreground hover:bg-muted">
      <Upload className="h-4 w-4" />
      <span>上传文件</span>
      <input type="file" className="sr-only" multiple onChange={handleChange} />
    </label>
  );
}
