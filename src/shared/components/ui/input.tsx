import { type InputHTMLAttributes, forwardRef } from "react";

import { cn } from "@/shared/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-[2.75rem] w-full rounded-none border border-input bg-card px-3 text-[1rem] outline-none transition-[border-color,background-color] duration-[var(--motion-fast)] ease-[var(--ease-out)] hoverable:hover:border-foreground/25 focus-visible:border-foreground focus-visible:border-l-[2px] focus-visible:border-l-brand-yellow focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/20 aria-[invalid=true]:border-destructive aria-[invalid=true]:border-l-destructive disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-55",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
