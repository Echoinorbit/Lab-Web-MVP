"use client";

import { Textarea } from "@/shared/components/ui/textarea";

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  name,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
}) {
  return (
    <Textarea
      name={name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      spellCheck={false}
    />
  );
}
