import { type SelectHTMLAttributes, forwardRef } from "react";

import { cn } from "@/shared/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-11 min-w-0 max-w-full rounded-lg border border-input bg-card/80 px-3.5 text-base outline-none transition-[border-color,box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:border-foreground/25 focus-visible:border-ring focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-ring/12 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15 disabled:cursor-not-allowed disabled:bg-muted/60 disabled:opacity-55 sm:text-[15px]",
        className,
      )}
      {...props}
    />
  ),
);
Select.displayName = "Select";
