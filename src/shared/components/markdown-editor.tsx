"use client";

import { Textarea } from "@/shared/components/ui/textarea";

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  name,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
}) {
  return (
    <Textarea
      name={name}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      disabled={disabled}
    />
  );
}
