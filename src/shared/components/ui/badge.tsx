import type { HTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center border border-border bg-muted px-2.5 py-1 font-mono text-[.75rem] font-medium uppercase leading-none tracking-[.04em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
