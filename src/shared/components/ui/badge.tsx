import type { HTMLAttributes } from "react";

import { cn } from "@/shared/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium leading-none text-muted-foreground ring-1 ring-inset ring-border",
        className,
      )}
      {...props}
    />
  );
}
