import type { HTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border border-border/80 bg-muted px-2.5 py-1 text-xs font-medium leading-none text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
