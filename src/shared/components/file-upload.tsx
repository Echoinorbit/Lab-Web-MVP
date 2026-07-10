"use client";

import { Upload } from "lucide-react";
import type { ChangeEvent } from "react";

export function FileUpload({ onFiles }: { onFiles: (files: File[]) => void }) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.target.files ?? []));
  };

  return (
    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-card px-4 py-7 text-sm font-medium text-muted-foreground transition-[color,background-color,border-color] duration-200 hover:border-foreground/20 hover:bg-muted hover:text-foreground focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
      <Upload className="h-4 w-4" />
      <span>上传文件</span>
      <input type="file" className="sr-only" multiple onChange={handleChange} />
    </label>
  );
}
