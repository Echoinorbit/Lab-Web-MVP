import { type TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "@/shared/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-36 w-full resize-y border border-input bg-card px-3.5 py-3 text-base leading-6 outline-none transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-out)] hoverable:hover:border-foreground/25 focus-visible:border-primary focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-primary/20 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-55 landscape:text-[15px]",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
