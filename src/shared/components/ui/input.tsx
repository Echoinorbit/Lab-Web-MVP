import { type InputHTMLAttributes, forwardRef } from "react";

import { cn } from "@/shared/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-input bg-card px-4 text-[15px] outline-none transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-fluid)] hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
