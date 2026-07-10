import { type TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "@/shared/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-28 w-full rounded-xl border border-input bg-card px-4 py-3 text-[15px] leading-6 outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
