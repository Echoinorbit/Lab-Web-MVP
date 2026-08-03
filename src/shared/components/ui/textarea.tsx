import { type TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "@/shared/lib/utils";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-36 w-full resize-y rounded-xl border border-input bg-card/80 px-4 py-3.5 text-base leading-6 outline-none transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:border-foreground/25 focus-visible:border-ring focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-ring/12 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-55 sm:text-[15px]",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
