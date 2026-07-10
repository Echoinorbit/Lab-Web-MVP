"use client";

import { Upload } from "lucide-react";
import type { ChangeEvent } from "react";

export function FileUpload({ onFiles }: { onFiles: (files: File[]) => void }) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFiles(Array.from(event.target.files ?? []));
  };

  return (
    <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-background/55 px-4 py-6 text-center text-sm text-muted-foreground transition-[color,background-color,border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-fluid)] hover:border-foreground/25 hover:bg-muted/70 hover:text-foreground focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
        <Upload className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="font-medium text-foreground">选择要上传的文件</span>
      <span className="text-xs">也可以一次选择多个文件</span>
      <input type="file" className="sr-only" multiple onChange={handleChange} />
    </label>
  );
}
